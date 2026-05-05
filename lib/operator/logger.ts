import { normalizeLogLevel, type LogLevel } from "@/lib/bootstrap-status";

const levelRank: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
};

const secretKeyPattern = /(authorization|password|secret|token|code|jwt|key)/i;

export function redactLogMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [key, secretKeyPattern.test(key) ? "[redacted]" : value]),
  );
}

export function operatorLog(level: LogLevel, message: string, metadata: Record<string, unknown> = {}) {
  const configured = normalizeLogLevel(process.env.LOG_LEVEL);
  if (levelRank[level] < levelRank[configured]) {
    return;
  }

  console.log(
    JSON.stringify({
      time: new Date().toISOString(),
      level,
      message,
      ...redactLogMetadata(metadata),
    }),
  );
}
