import { PRIMARY_MODEL } from './gemini-provider';
import type { ExperimentRequestAccountant } from './request-budget';

export interface GeminiPreflightResult {
  ready: boolean;
  model: string;
  latencyMs: number;
  status: 'READY' | 'QUOTA_EXHAUSTED' | 'AUTH_ERROR' | 'NETWORK_ERROR' | 'NOT_CONFIGURED';
  errorCode?: string;
  errorMessage?: string;
  retryAfter?: string;
  usageMetadata?: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
    isSyntheticTokenCount: false;
  };
  rawResponse?: string;
}

/**
 * Executes a lightweight preflight probe to verify Google Gemini API availability,
 * authentication, and quota status with minimal token consumption.
 *
 * If an ExperimentRequestAccountant is provided, preflight quota usage is bounded
 * and recorded at the HTTP boundary.
 *
 * Never uses fallback or synthetic fixtures. Strictly probes the live API.
 */
export async function runGeminiPreflight(
  model: string = PRIMARY_MODEL,
  timeoutMs: number = 25000,
  accountant?: ExperimentRequestAccountant
): Promise<GeminiPreflightResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const startTime = Date.now();

  if (!apiKey || apiKey.trim().length === 0 || apiKey.includes('REPLACE_WITH')) {
    return {
      ready: false,
      model,
      latencyMs: 0,
      status: 'NOT_CONFIGURED',
      errorCode: 'GEMINI_KEY_MISSING',
      errorMessage: 'GEMINI_API_KEY is not configured or is a placeholder',
    };
  }

  // Preflight budget gate with in-flight reservation
  let releaseReservation: (() => void) | null = null;
  if (accountant) {
    releaseReservation = accountant.acquireReservation('preflight');
  }

  let fetchRecorded = false;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: 'Respond with the word "PONG".' }],
      },
    ],
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 5,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;
    const bodyText = await response.text();

    if (response.ok) {
      let parsed: any;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        parsed = {};
      }

      const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      const usage = parsed.usageMetadata || {};

      const promptTokens = usage.promptTokenCount || 0;
      const candidatesTokens = usage.candidatesTokenCount || 0;
      const totalTokens = usage.totalTokenCount || (promptTokens + candidatesTokens);

      if (accountant) {
        accountant.recordRequest({
          type: 'preflight',
          durationMs: latencyMs,
          success: true,
          model,
          tokens: {
            promptTokens,
            candidatesTokens,
            totalTokens,
          },
        });
        fetchRecorded = true;
      }

      return {
        ready: true,
        model,
        latencyMs,
        status: 'READY',
        rawResponse: text,
        usageMetadata: {
          promptTokens,
          candidatesTokens,
          totalTokens,
          isSyntheticTokenCount: false,
        },
      };
    }

    // Extract error details
    let errorObj: any;
    try {
      errorObj = JSON.parse(bodyText);
    } catch {
      errorObj = {};
    }

    const errorMsg = errorObj.error?.message || bodyText || `HTTP ${response.status}`;
    const httpStatus = response.status;

    let resultStatus: GeminiPreflightResult['status'] = 'NETWORK_ERROR';
    let errorCode = `HTTP_${httpStatus}`;
    let retryAfter: string | undefined;

    if (httpStatus === 429 || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      const retryMatch = errorMsg.match(/Please retry in\s+([0-9a-zA-Z._]+)/i);
      retryAfter = retryMatch ? retryMatch[1] : undefined;
      resultStatus = 'QUOTA_EXHAUSTED';
      errorCode = 'GEMINI_QUOTA_EXCEEDED';
    } else if (httpStatus === 401 || httpStatus === 403) {
      resultStatus = 'AUTH_ERROR';
      errorCode = 'GEMINI_AUTH_FAILED';
    }

    if (accountant) {
      accountant.recordRequest({
        type: 'preflight',
        durationMs: latencyMs,
        success: false,
        model,
        tokens: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 },
        errorCode,
        errorMessage: errorMsg,
      });
      fetchRecorded = true;
    }

    return {
      ready: false,
      model,
      latencyMs,
      status: resultStatus,
      errorCode,
      errorMessage: errorMsg,
      retryAfter,
    };
  } catch (err: any) {
    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;
    const errorCode = err.name === 'AbortError' ? 'PREFLIGHT_TIMEOUT' : 'FETCH_FAILED';

    if (accountant) {
      accountant.recordRequest({
        type: 'preflight',
        durationMs: latencyMs,
        success: false,
        model,
        tokens: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 },
        errorCode,
        errorMessage: err.message,
      });
      fetchRecorded = true;
    }

    return {
      ready: false,
      model,
      latencyMs,
      status: 'NETWORK_ERROR',
      errorCode,
      errorMessage: err.message,
    };
  } finally {
    if (!fetchRecorded && releaseReservation) {
      releaseReservation();
    }
  }
}
