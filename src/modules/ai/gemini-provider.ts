import { ApplicationPlan, GeneratedFile, ProjectSpecification } from '@/types';
import { validateSafePath } from '@/server/security/safe-paths';
import { generateProjectFiles, modifyProjectFiles } from '@/modules/generation/generator';
import type { ExperimentRequestAccountant, RequestCategory } from './request-budget';
import { z } from 'zod';

export interface GeminiProviderResult {
  success: boolean;
  files: GeneratedFile[];
  summary?: string;
  modelIdentifier: string;
  modelProvider: 'gemini' | 'deterministic';
  usageMetadata?: {
    tokens?: number;
    filesCount?: number;
    durationMs?: number;
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
    thoughtTokens?: number;
    isSyntheticTokenCount?: boolean;
  };
  error?: string;
  errorCode?: string;
  rawHttpStatus?: number;
  fallbackUsed?: boolean;
}

const GeminiFileSchema = z.object({
  path: z.string().min(1),
  responsibility: z.string().default('Generated component'),
  fileType: z.enum(['page', 'component', 'layout', 'api', 'lib', 'config', 'style', 'asset']).default('lib'),
  content: z.string(),
});

const GeminiResponseSchema = z.object({
  summary: z.string().optional(),
  files: z.array(GeminiFileSchema).min(1),
});

export const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
export const ENABLE_GEMINI_FALLBACK = process.env.ENABLE_GEMINI_FALLBACK === 'true';
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.8-flash';
const MAX_RETRIES = 1;
const REQUEST_TIMEOUT_MS = process.env.GEMINI_TIMEOUT_MS ? parseInt(process.env.GEMINI_TIMEOUT_MS, 10) : 55000;
const FALLBACK_TIMEOUT_MS = process.env.GEMINI_FALLBACK_TIMEOUT_MS ? parseInt(process.env.GEMINI_FALLBACK_TIMEOUT_MS, 10) : 25000;

/**
 * Checks whether GEMINI_API_KEY is configured in the environment.
 */
export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 0 && !key.includes('REPLACE_WITH'));
}

/**
 * Executes a REST call to Google Gemini API with structured JSON output schema and bounded retries.
 * Enforces atomic request-level accounting at the HTTP boundary if an accountant is provided.
 */
async function callGeminiApi(
  systemPrompt: string,
  userPrompt: string,
  model = PRIMARY_MODEL,
  signal?: AbortSignal,
  timeoutMs = REQUEST_TIMEOUT_MS,
  accountant?: ExperimentRequestAccountant,
  category: RequestCategory = 'generation'
): Promise<{ data: any; usage?: any; rawText?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
      responseSchema: {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING', description: 'Brief architectural summary of generated code' },
          files: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                path: { type: 'STRING', description: 'Relative file path inside the project' },
                responsibility: { type: 'STRING', description: 'Single architectural responsibility' },
                fileType: {
                  type: 'STRING',
                  enum: ['page', 'component', 'layout', 'api', 'lib', 'config', 'style'],
                },
                content: { type: 'STRING', description: 'Complete source code' },
              },
              required: ['path', 'responsibility', 'fileType', 'content'],
            },
          },
        },
        required: ['files'],
      },
    },
  };

  let lastError: any = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) {
      const cancelErr: any = new Error('Generation cancelled by user');
      cancelErr.isCancelled = true;
      cancelErr.name = 'AbortError';
      throw cancelErr;
    }

    // Atomic request budget enforcement and in-flight reservation before hitting network
    let releaseReservation: (() => void) | null = null;
    if (accountant) {
      releaseReservation = accountant.acquireReservation(category);
    }

    let fetchRecorded = false;
    const fetchStart = Date.now();

    try {
      if (attempt > 0) {
        // Fast backoff with jitter (fast in tests)
        const base = process.env.NODE_ENV === 'test' ? 10 : 800;
        const delay = Math.min(base * Math.pow(2, attempt) + (process.env.NODE_ENV === 'test' ? 0 : Math.random() * 200), 2000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      if (signal?.aborted) {
        const cancelErr: any = new Error('Generation cancelled by user');
        cancelErr.isCancelled = true;
        cancelErr.name = 'AbortError';
        throw cancelErr;
      }

      const timeoutSignal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined;
      const combinedSignal = signal && timeoutSignal && typeof (AbortSignal as any).any === 'function'
        ? (AbortSignal as any).any([signal, timeoutSignal])
        : (signal || timeoutSignal);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: combinedSignal,
      });

      const fetchDurationMs = Date.now() - fetchStart;

      if (!res.ok) {
        let rawErrorText = '';
        try {
          rawErrorText = await res.text();
        } catch {
          rawErrorText = '';
        }

        let errorJson: any = null;
        try {
          errorJson = JSON.parse(rawErrorText);
        } catch {
          errorJson = null;
        }

        const rawMsg = errorJson?.error?.message || rawErrorText || `Gemini API returned HTTP ${res.status}`;
        // Sanitize and length-limit upstream diagnostic message (max 500 chars, strip control characters)
        const sanitizedMsg = String(rawMsg)
          .replace(/[\x00-\x1F\x7F]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 500);

        const errMsg = sanitizedMsg || `Gemini API returned HTTP ${res.status}`;
        const errStatus = errorJson?.error?.status || res.status;

        const isQuota = res.status === 429 || errMsg.includes('RESOURCE_EXHAUSTED');
        const isAuth = res.status === 401 || res.status === 403;
        const isNotFound = res.status === 404;
        const errorCode = isQuota
          ? 'GEMINI_QUOTA_EXCEEDED'
          : isAuth
          ? 'GEMINI_INVALID_KEY'
          : isNotFound
          ? 'GEMINI_MODEL_UNAVAILABLE'
          : `HTTP_${res.status}`;

        if (accountant) {
          accountant.recordRequest({
            type: category,
            durationMs: fetchDurationMs,
            success: false,
            model,
            attempt,
            tokens: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 },
            errorCode,
            errorMessage: errMsg,
          });
          fetchRecorded = true;
        }

        const errorObj: any = new Error(errMsg);
        errorObj.status = res.status;
        errorObj.apiStatus = errStatus;
        errorObj.details = errorJson;

        // Distinguish daily quota exhaustion (fatal, futile to retry) from transient burst rate-limits
        const isDailyQuotaExhausted =
          res.status === 429 &&
          (errMsg.includes('per day limit exceeded') ||
            errMsg.includes('free_tier_requests') ||
            /Please retry in\s+[0-9]+[hm]/i.test(errMsg));

        // Fatal client/auth/config errors OR daily quota exhaustion: never retry
        if (
          res.status === 400 ||
          res.status === 401 ||
          res.status === 403 ||
          res.status === 404 ||
          isDailyQuotaExhausted
        ) {
          errorObj.isFatal = true;
          throw errorObj;
        }

        // On transient 429 (RPM burst rate limit) or 503 transient service error, retry at most once
        if (res.status === 429 || res.status >= 500) {
          lastError = errorObj;
          continue;
        }

        throw errorObj;
      }

      const json = await res.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('Gemini response candidate text is empty');
      }

      const parsed = JSON.parse(rawText);
      const usage = json?.usageMetadata || {};
      const promptTokens = usage.promptTokenCount || 0;
      const candidatesTokens = usage.candidatesTokenCount || 0;
      const totalTokens = usage.totalTokenCount || (promptTokens + candidatesTokens);

      if (accountant) {
        accountant.recordRequest({
          type: category,
          durationMs: fetchDurationMs,
          success: true,
          model,
          attempt,
          tokens: {
            promptTokens,
            candidatesTokens,
            totalTokens,
          },
        });
        fetchRecorded = true;
      }

      return {
        data: parsed,
        usage: json?.usageMetadata,
        rawText,
      };
    } catch (err: any) {
      if (signal?.aborted || err?.isCancelled || (err.name === 'AbortError' && signal?.aborted)) {
        const cancelErr: any = new Error('Generation cancelled by user');
        cancelErr.isCancelled = true;
        cancelErr.name = 'AbortError';
        throw cancelErr;
      }

      if (accountant && !fetchRecorded) {
        accountant.recordRequest({
          type: category,
          durationMs: Date.now() - fetchStart,
          success: false,
          model,
          attempt,
          tokens: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 },
          errorCode: err.name === 'AbortError' ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
          errorMessage: err.message,
        });
      }

      lastError = err;
      // Immediately abort loop on fatal errors (auth, not found, or bad request)
      if (err.isFatal || err.status === 400 || err.status === 401 || err.status === 403 || err.status === 404 || attempt >= MAX_RETRIES) {
        break;
      }
    } finally {
      if (!fetchRecorded && releaseReservation) {
        releaseReservation();
      }
    }
  }

  throw lastError;
}

export class GeminiProvider {
  /**
   * Generates a complete application using Gemini AI structured output.
   * If Gemini is not configured, or if quota/network errors occur, cleanly falls back
   * to Shipshape's deterministic domain catalog engine with honest diagnostic logging.
   */
  static async generateProject(
    plan: ApplicationPlan,
    specification: ProjectSpecification,
    onLog?: (msg: string, level?: 'stdout' | 'stderr' | 'system') => Promise<void>,
    signal?: AbortSignal,
    accountant?: ExperimentRequestAccountant
  ): Promise<GeminiProviderResult> {
    if (signal?.aborted) {
      const cancelErr: any = new Error('Generation cancelled by user');
      cancelErr.isCancelled = true;
      cancelErr.name = 'AbortError';
      throw cancelErr;
    }

    if (!isGeminiConfigured()) {
      if (onLog) {
        await onLog('[AI PROVIDER] GEMINI_API_KEY not configured. Using deterministic domain engine.', 'system');
      }
      const files = await generateProjectFiles(plan, specification);
      return {
        success: true,
        files,
        summary: 'Generated using Shipshape deterministic domain catalog',
        modelIdentifier: 'deterministic-engine-v1',
        modelProvider: 'deterministic',
        fallbackUsed: false,
      };
    }

    if (onLog) {
      await onLog(`[AI PROVIDER] Connecting to Google Gemini API (model: ${PRIMARY_MODEL})...`, 'stdout');
    }

    const appName = specification.name || 'Shipshape Application';
    const appDesc = specification.description || 'Full-stack application';

    const systemPrompt = `You are Shipshape's Senior Full-Stack Engineering Agent.
Synthesize a production-ready, clean Next.js 14+ App Router application with Tailwind CSS and local storage persistence.
Requirements:
1. All client interactive files must include 'use client' at line 1.
2. Root layout or components must use valid standard React and HTML5 elements.
3. Navigation links must use <a href="..."> or Next.js Link with import Link from 'next/link' (NEVER import Link from 'next/navigation').
4. Do not import third-party libraries other than react and lucide-react.
5. Storage module must safely check typeof window !== 'undefined' and use LocalStorage for zero-loss persistence.
6. The application must feature real interactive forms, working buttons, and domain-appropriate sample data directly fulfilling the user prompt.`;

    const targetRoutes = (plan?.routes || []).map((r) => ({ path: r.path, name: r.name, description: r.description }));
    const coreFeatures = (plan?.specification?.features || []).map((f) => f.name);
    const dataEntities = (plan?.specification?.dataEntities || []).map((e) => ({ name: e.name, fields: e.fields }));

    const userPrompt = `Build an application named "${appName}".
Description & Requirements: "${appDesc}"
Target Routes: ${JSON.stringify(targetRoutes)}
Core Features: ${JSON.stringify(coreFeatures)}
Data Model Entities: ${JSON.stringify(dataEntities)}

Synthesize the complete application logic according to the requirements above:
- src/app/page.tsx: Main responsive interface fulfilling all requested features (e.g. hero, CTA, and pricing cards for landing pages; Kanban columns, task creation, and drag/move for task management; metrics and controls for dashboards).
- src/components/HeaderNav.tsx: Accessible header navigation with brand logo/title and links.
- src/components/: Domain-specific interactive components (e.g. pricing cards, modals, filterable lists).
- src/lib/storage.ts: Strongly-typed client state management and seed data with LocalStorage persistence.

Standard configuration files (package.json, tsconfig.json, next.config.mjs, globals.css, layout.tsx) are automatically supplied by the platform harness.`;

    try {
      let result;
      try {
        result = await callGeminiApi(systemPrompt, userPrompt, PRIMARY_MODEL, signal, REQUEST_TIMEOUT_MS, accountant, 'generation');
      } catch (primaryErr: any) {
        if (signal?.aborted || primaryErr?.isCancelled) {
          throw primaryErr;
        }
        if (primaryErr.isFatal || [400, 401, 403, 404].includes(primaryErr.status)) {
          throw primaryErr;
        }
        if (ENABLE_GEMINI_FALLBACK && FALLBACK_MODEL && FALLBACK_MODEL !== PRIMARY_MODEL) {
          if (onLog) {
            await onLog(`[AI PROVIDER] ${PRIMARY_MODEL} returned error (${primaryErr.message}). Retrying with gated fallback ${FALLBACK_MODEL}...`, 'stderr');
          }
          result = await callGeminiApi(systemPrompt, userPrompt, FALLBACK_MODEL, signal, FALLBACK_TIMEOUT_MS, accountant, 'generation');
        } else {
          // Gemini 3.8 fallback is disabled by default to prevent secondary timeout delays on unverified endpoints
          throw primaryErr;
        }
      }

      // Validate structured output with Zod
      const parsedOutput = GeminiResponseSchema.safeParse(result.data);
      if (!parsedOutput.success) {
        throw new Error(`Gemini structured output validation failed: ${parsedOutput.error.message}`);
      }

      // Sanitize paths and construct GeneratedFile list
      const sanitizedFiles: GeneratedFile[] = [];
      for (const rawFile of parsedOutput.data.files) {
        const check = validateSafePath(rawFile.path);
        if (!check.isValid) {
          if (onLog) {
            await onLog(`[AI PROVIDER] Dropping unsafe path from Gemini: ${rawFile.path} (${check.error})`, 'stderr');
          }
          continue;
        }

        sanitizedFiles.push({
          path: check.normalizedPath,
          responsibility: rawFile.responsibility,
          fileType: rawFile.fileType,
          content: rawFile.content,
          sizeBytes: Buffer.byteLength(rawFile.content, 'utf-8'),
          mimeType: rawFile.path.endsWith('.css')
            ? 'text/css'
            : rawFile.path.endsWith('.json')
            ? 'application/json'
            : 'text/typescript',
          isNew: true,
        });
      }

      // Ensure all standard core template files exist, falling back to deterministic templates for any omitted files
      const deterministicFallbackFiles = await generateProjectFiles(plan, specification);
      for (const fallbackFile of deterministicFallbackFiles) {
        if (!sanitizedFiles.some((f) => f.path === fallbackFile.path)) {
          sanitizedFiles.push(fallbackFile);
        }
      }

      if (onLog) {
        await onLog(`[AI PROVIDER] Successfully synthesized ${sanitizedFiles.length} files using Gemini AI (${result.usage?.totalTokens || 0} tokens).`, 'stdout');
      }

      return {
        success: true,
        files: sanitizedFiles,
        summary: parsedOutput.data.summary || 'Generated with Gemini AI',
        modelIdentifier: PRIMARY_MODEL,
        modelProvider: 'gemini',
        usageMetadata: {
          tokens: result.usage?.totalTokenCount,
          filesCount: sanitizedFiles.length,
          promptTokens: result.usage?.promptTokenCount,
          candidatesTokens: result.usage?.candidatesTokenCount,
          totalTokens: result.usage?.totalTokenCount,
          isSyntheticTokenCount: false,
        },
        fallbackUsed: false,
      };
    } catch (geminiError: any) {
      if (signal?.aborted || geminiError?.isCancelled) {
        throw geminiError;
      }

      const isQuota = geminiError.status === 429 || geminiError.apiStatus === 'RESOURCE_EXHAUSTED';
      const isAuth = geminiError.status === 401 || geminiError.status === 403;
      const isNotFound = geminiError.status === 404;
      const errorCode = isQuota
        ? 'GEMINI_QUOTA_EXCEEDED'
        : isAuth
        ? 'GEMINI_INVALID_KEY'
        : isNotFound
        ? 'GEMINI_MODEL_UNAVAILABLE'
        : 'GEMINI_INFERENCE_ERROR';

      if (onLog) {
        await onLog(`[AI PROVIDER] Gemini request failed [${errorCode}]: ${geminiError.message}`, 'stderr');
        await onLog('[AI PROVIDER] Seamlessly synthesizing via Shipshape deterministic domain catalog...', 'system');
      }

      const files = await generateProjectFiles(plan, specification);
      return {
        success: true,
        files,
        summary: `Deterministic fallback after Gemini error (${geminiError.message})`,
        modelIdentifier: 'deterministic-engine-v1',
        modelProvider: 'deterministic',
        errorCode,
        error: geminiError.message,
        rawHttpStatus: geminiError.status,
        fallbackUsed: true,
      };
    }
  }

  /**
   * Modifies an existing application based on natural language instructions using Gemini.
   */
  static async modifyProject(
    baseFiles: GeneratedFile[],
    instruction: string,
    specification?: ProjectSpecification | null,
    onLog?: (msg: string, level?: 'stdout' | 'stderr' | 'system') => Promise<void>,
    signal?: AbortSignal,
    accountant?: ExperimentRequestAccountant,
    category: 'modification' | 'repair' = 'modification'
  ): Promise<GeminiProviderResult> {
    if (signal?.aborted) {
      const cancelErr: any = new Error('Generation cancelled by user');
      cancelErr.isCancelled = true;
      cancelErr.name = 'AbortError';
      throw cancelErr;
    }

    if (!isGeminiConfigured()) {
      if (onLog) {
        await onLog('[AI PROVIDER] GEMINI_API_KEY not configured. Using deterministic modification engine.', 'system');
      }
      const { modifiedFiles, changeSummary } = await modifyProjectFiles(baseFiles, instruction);
      return {
        success: true,
        files: modifiedFiles,
        summary: changeSummary,
        modelIdentifier: 'deterministic-engine-v1',
        modelProvider: 'deterministic',
        fallbackUsed: false,
      };
    }

    if (onLog) {
      await onLog(`[AI PROVIDER] Submitting ${category} to Gemini (${instruction})...`, 'stdout');
    }

    const systemPrompt = `You are Shipshape's Senior Engineering Modification Agent.
Given an existing Next.js App Router codebase and user instruction, return the updated or newly added files.
Return ONLY files that need to be modified or created. Keep untouched files out of the output array.`;

    const userPrompt = `Project: ${specification?.name || 'Application'}
User Modification Request: "${instruction}"

Existing File Manifest:
${baseFiles.map((f) => `- ${f.path}: ${f.responsibility}`).join('\n')}

Key existing file excerpts:
${baseFiles
  .filter((f) => f.path.includes('page.tsx') || f.path.includes('storage.ts'))
  .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 1500)}`)
  .join('\n\n')}

Return the updated or created files in the structured JSON schema.`;

    try {
      let result;
      try {
        result = await callGeminiApi(systemPrompt, userPrompt, PRIMARY_MODEL, signal, REQUEST_TIMEOUT_MS, accountant, category);
      } catch (primaryErr: any) {
        if (signal?.aborted || primaryErr?.isCancelled) {
          throw primaryErr;
        }
        if (primaryErr.isFatal || [400, 401, 403, 404].includes(primaryErr.status)) {
          throw primaryErr;
        }
        if (ENABLE_GEMINI_FALLBACK && FALLBACK_MODEL && FALLBACK_MODEL !== PRIMARY_MODEL) {
          if (onLog) {
            await onLog(`[AI PROVIDER] ${PRIMARY_MODEL} returned error (${primaryErr.message}). Retrying with gated fallback ${FALLBACK_MODEL}...`, 'stderr');
          }
          result = await callGeminiApi(systemPrompt, userPrompt, FALLBACK_MODEL, signal, FALLBACK_TIMEOUT_MS, accountant, category);
        } else {
          throw primaryErr;
        }
      }
      const parsedOutput = GeminiResponseSchema.safeParse(result.data);
      if (!parsedOutput.success) {
        throw new Error(`Gemini modification output validation failed: ${parsedOutput.error.message}`);
      }

      // Merge modified files into base files
      const updatedMap = new Map<string, GeneratedFile>();
      for (const f of baseFiles) {
        updatedMap.set(f.path, f);
      }

      for (const modFile of parsedOutput.data.files) {
        const check = validateSafePath(modFile.path);
        if (!check.isValid) continue;

        const isExisting = updatedMap.has(check.normalizedPath);
        updatedMap.set(check.normalizedPath, {
          path: check.normalizedPath,
          responsibility: modFile.responsibility,
          fileType: modFile.fileType,
          content: modFile.content,
          sizeBytes: Buffer.byteLength(modFile.content, 'utf-8'),
          mimeType: check.normalizedPath.endsWith('.css')
            ? 'text/css'
            : check.normalizedPath.endsWith('.json')
            ? 'application/json'
            : 'text/typescript',
          isNew: !isExisting,
          isModified: isExisting,
        });
      }

      const finalFiles = Array.from(updatedMap.values());

      if (onLog) {
        await onLog(`[AI PROVIDER] Applied modifications to ${parsedOutput.data.files.length} files with Gemini AI.`, 'stdout');
      }

      return {
        success: true,
        files: finalFiles,
        summary: parsedOutput.data.summary || `Modified: ${instruction}`,
        modelIdentifier: PRIMARY_MODEL,
        modelProvider: 'gemini',
        usageMetadata: {
          tokens: result.usage?.totalTokenCount,
          filesCount: finalFiles.length,
          promptTokens: result.usage?.promptTokenCount,
          candidatesTokens: result.usage?.candidatesTokenCount,
          totalTokens: result.usage?.totalTokenCount,
          isSyntheticTokenCount: false,
        },
        fallbackUsed: false,
      };
    } catch (err: any) {
      if (signal?.aborted || err?.isCancelled) {
        throw err;
      }

      if (onLog) {
        await onLog(`[AI PROVIDER] Gemini modification failed (${err.message}). Using deterministic fallback.`, 'stderr');
      }
      const isQuota = err.status === 429 || err.apiStatus === 'RESOURCE_EXHAUSTED';
      const isAuth = err.status === 401 || err.status === 403;
      const isNotFound = err.status === 404;
      const errorCode = isQuota
        ? 'GEMINI_QUOTA_EXCEEDED'
        : isAuth
        ? 'GEMINI_INVALID_KEY'
        : isNotFound
        ? 'GEMINI_MODEL_UNAVAILABLE'
        : 'GEMINI_MODIFICATION_ERROR';

      const { modifiedFiles } = await modifyProjectFiles(baseFiles, instruction);
      return {
        success: true,
        files: modifiedFiles,
        summary: `Deterministic modification fallback (${err.message})`,
        modelIdentifier: 'deterministic-engine-v1',
        modelProvider: 'deterministic',
        errorCode,
        error: err.message,
        rawHttpStatus: err.status,
        fallbackUsed: true,
        usageMetadata: {
          tokens: 0,
          filesCount: modifiedFiles.length,
          isSyntheticTokenCount: false,
        },
      };
    }
  }
}
