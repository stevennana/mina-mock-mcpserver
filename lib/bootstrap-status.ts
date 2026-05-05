const allowedLogLevels = ["trace", "debug", "info", "warn", "error"] as const;

export type LogLevel = (typeof allowedLogLevels)[number];

export function normalizeLogLevel(value: string | undefined): LogLevel {
  if (value && allowedLogLevels.includes(value as LogLevel)) {
    return value as LogLevel;
  }

  return "info";
}

export function getBootstrapStatus() {
  return {
    runtimeState: "prepared",
    logLevel: normalizeLogLevel(process.env.LOG_LEVEL),
  };
}
