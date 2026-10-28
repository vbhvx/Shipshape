import { ApplicationPlan, GeneratedFile, ProjectSpecification } from '@/types';
import { validateSafePath } from '@/server/security/safe-paths';
import { generateProjectFiles, modifyProjectFiles } from '@/modules/generation/generator';
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
  };
  error?: string;
  errorCode?: string;
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

const PRIMARY_MODEL = 'gemini-2.0-flash';
const FALLBACK_MODEL = 'gemini-1.5-flash';
const MAX_RETRIES = 2;

/**
 * Checks whether GEMINI_API_KEY is configured in the environment.
 */
export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 0 && !key.includes('REPLACE_WITH'));
}

/**
 * Executes a REST call to Google Gemini API with structured JSON output schema and bounded retries.
 */
async function callGeminiApi(
  systemPrompt: string,
  userPrompt: string,
  model = PRIMARY_MODEL
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
    try {
      if (attempt > 0) {
        // Exponential backoff with jitter (fast in tests)
        const base = process.env.NODE_ENV === 'test' ? 10 : 1000;
        const delay = Math.min(base * Math.pow(2, attempt) + (process.env.NODE_ENV === 'test' ? 0 : Math.random() * 500), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => null);
        const errMsg = errorJson?.error?.message || `Gemini API returned HTTP ${res.status}`;
        const errStatus = errorJson?.error?.status || res.status;

        const errorObj: any = new Error(errMsg);
        errorObj.status = res.status;
        errorObj.apiStatus = errStatus;
        errorObj.details = errorJson;

        // On 429 quota or 503 transient error, retry
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
      return {
        data: parsed,
        usage: json?.usageMetadata,
        rawText,
      };
    } catch (err: any) {
      lastError = err;
      if (attempt === MAX_RETRIES) {
        break;
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
    onLog?: (msg: string, level?: 'stdout' | 'stderr' | 'system') => Promise<void>
  ): Promise<GeminiProviderResult> {
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
2. Root layout must export metadata and default function RootLayout({ children }: { children: React.ReactNode }).
3. Navigation links must use <a href="..."> or Next.js link with valid imports (NEVER import Link from 'next/navigation').
4. The application must feature real interactive forms, working checkboxes, and domain-appropriate sample data.
5. Storage module must safely check typeof window !== 'undefined' and use LocalStorage for zero-loss persistence.`;

    const targetRoutes = (plan?.routes || []).map((r) => ({ path: r.path, name: r.name, description: r.description }));
    const coreFeatures = (plan?.specification?.features || []).map((f) => f.name);
    const dataEntities = (plan?.specification?.dataEntities || []).map((e) => ({ name: e.name, fields: e.fields }));

    const userPrompt = `Build an application named "${appName}".
Description & Requirements: "${appDesc}"
Target Routes: ${JSON.stringify(targetRoutes)}
Core Features: ${JSON.stringify(coreFeatures)}
Data Model Entities: ${JSON.stringify(dataEntities)}

Focus on synthesizing the core application logic and components:
- src/app/page.tsx (Dashboard with metrics, interactive quick-add, and checklist items)
- src/app/explore/page.tsx (Filterable data table and CSV export)
- src/components/HeaderNav.tsx
- src/components/ItemModal.tsx
- src/lib/storage.ts (Typed storage manager with seed data and persistence)

Standard configuration files (package.json, tsconfig.json, globals.css, layout.tsx) are automatically supplied by the platform harness.`;

    try {
      let result;
      try {
        result = await callGeminiApi(systemPrompt, userPrompt, PRIMARY_MODEL);
      } catch (primaryErr: any) {
        if (onLog) {
          await onLog(`[AI PROVIDER] ${PRIMARY_MODEL} returned error (${primaryErr.message}). Retrying with ${FALLBACK_MODEL}...`, 'stderr');
        }
        result = await callGeminiApi(systemPrompt, userPrompt, FALLBACK_MODEL);
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
        },
        fallbackUsed: false,
      };
    } catch (geminiError: any) {
      const isQuota = geminiError.status === 429 || geminiError.apiStatus === 'RESOURCE_EXHAUSTED';
      const isAuth = geminiError.status === 401 || geminiError.status === 403;
      const errorCode = isQuota ? 'GEMINI_QUOTA_EXCEEDED' : isAuth ? 'GEMINI_INVALID_KEY' : 'GEMINI_INFERENCE_ERROR';

      if (onLog) {
        await onLog(`[AI PROVIDER] Gemini request failed [${errorCode}]: ${geminiError.message}`, 'stderr');
        await onLog('[AI PROVIDER] Seamlessly falling back to Shipshape deterministic domain catalog...', 'system');
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
    onLog?: (msg: string, level?: 'stdout' | 'stderr' | 'system') => Promise<void>
  ): Promise<GeminiProviderResult> {
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
      await onLog(`[AI PROVIDER] Submitting modification to Gemini (${instruction})...`, 'stdout');
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
      const result = await callGeminiApi(systemPrompt, userPrompt, PRIMARY_MODEL);
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
        },
        fallbackUsed: false,
      };
    } catch (err: any) {
      if (onLog) {
        await onLog(`[AI PROVIDER] Gemini modification failed (${err.message}). Using deterministic fallback.`, 'stderr');
      }
      const { modifiedFiles } = await modifyProjectFiles(baseFiles, instruction);
      return {
        success: true,
        files: modifiedFiles,
        summary: `Deterministic modification fallback (${err.message})`,
        modelIdentifier: 'deterministic-engine-v1',
        modelProvider: 'deterministic',
        errorCode: 'GEMINI_MODIFICATION_ERROR',
        error: err.message,
        fallbackUsed: true,
      };
    }
  }
}
