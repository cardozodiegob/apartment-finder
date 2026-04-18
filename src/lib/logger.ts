/**
 * Minimal structured logger.
 *
 * Emits JSON lines to stdout/stderr. Swap the writer when you integrate
 * GlitchTip / Sentry — `init()` picks them up automatically when the matching
 * env var is present.
 */

type Level = "debug" | "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
}

function emit(level: Level, message: string, fields?: LogFields) {
  const record = {
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  const line = JSON.stringify(record);
  if (level === "error" || level === "warn") {
    console[level](line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => emit("debug", message, fields),
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};

/**
 * Capture an unhandled error. Writes to the structured logger AND persists
 * a lightweight record in Mongo so `/admin/errors` can surface it.
 */
export async function captureError(err: unknown, context?: LogFields): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(message, { ...context, stack });

  try {
    const dbConnect = (await import("@/lib/db/connection")).default;
    const { default: ErrorEvent } = await import("@/lib/db/models/ErrorEvent");
    await dbConnect();
    await ErrorEvent.create({ message, stack, context: context ?? {} });
  } catch { /* don't let telemetry errors crash the caller */ }
}
