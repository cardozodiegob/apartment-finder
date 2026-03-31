/**
 * Structured JSON logging with correlation IDs.
 */

type LogLevel = "info" | "warn" | "error" | "critical";

let correlationCounter = 0;

export function generateCorrelationId(): string {
  correlationCounter += 1;
  return `req-${Date.now()}-${correlationCounter}`;
}

export function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  if (level === "error" || level === "critical") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}
