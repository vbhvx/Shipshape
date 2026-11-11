/**
 * Structured logger.
 *
 * Production emits one JSON object per line so log drains (Vercel, Datadog,
 * Loki, CloudWatch) can index fields without parsing. Development emits a
 * compact human-readable line. Values under sensitive keys are redacted before
 * serialization so request bodies and provider responses can be logged safely.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(bindings: LogFields): Logger;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|session/i;

const REDACTED = '[REDACTED]';

function resolveMinLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  if (configured && configured in LEVEL_WEIGHT) {
    return configured as LogLevel;
  }
  if (process.env.NODE_ENV === 'test') return 'warn';
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  const output: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(inner, depth + 1);
  }
  return output;
}

export function serializeError(err: unknown): LogFields {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      ...(process.env.NODE_ENV !== 'production' || LEVEL_WEIGHT[resolveMinLevel()] <= LEVEL_WEIGHT.debug
        ? { stack: err.stack }
        : {}),
      ...('code' in err && err.code !== undefined ? { code: err.code } : {}),
      ...(err.cause !== undefined ? { cause: serializeError(err.cause) } : {}),
    };
  }
  return { message: String(err) };
}

function write(level: LogLevel, message: string, fields: LogFields): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[resolveMinLevel()]) {
    return;
  }

  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  const payload = redact(fields) as LogFields;

  if (process.env.NODE_ENV === 'production') {
    sink(
      JSON.stringify({
        level,
        time: new Date().toISOString(),
        msg: message,
        service: 'shipshape',
        ...payload,
      })
    );
    return;
  }

  const suffix = Object.keys(payload).length > 0 ? ` ${JSON.stringify(payload)}` : '';
  sink(`[${level.toUpperCase()}] ${message}${suffix}`);
}

function createLogger(bindings: LogFields): Logger {
  return {
    debug: (message, fields) => write('debug', message, { ...bindings, ...fields }),
    info: (message, fields) => write('info', message, { ...bindings, ...fields }),
    warn: (message, fields) => write('warn', message, { ...bindings, ...fields }),
    error: (message, fields) => write('error', message, { ...bindings, ...fields }),
    child: (extra) => createLogger({ ...bindings, ...extra }),
  };
}

export const logger: Logger = createLogger({});
