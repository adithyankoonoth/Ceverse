import { getEnv } from "@/lib/env";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export type LogContext = Record<string, unknown>;

function shouldLog(level: LogLevel): boolean {
  try {
    const configured = getEnv().LOG_LEVEL;
    return LEVEL_ORDER[level] >= LEVEL_ORDER[configured];
  } catch {
    return level !== "debug";
  }
}

function write(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    service: "ceverse",
    ...(context ?? {}),
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    // Structured info/debug logs — intentional console usage
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    write("debug", message, context);
  },
  info(message: string, context?: LogContext): void {
    write("info", message, context);
  },
  warn(message: string, context?: LogContext): void {
    write("warn", message, context);
  },
  error(message: string, context?: LogContext): void {
    write("error", message, context);
  },
  child(base: LogContext) {
    return {
      debug: (message: string, context?: LogContext) =>
        write("debug", message, { ...base, ...context }),
      info: (message: string, context?: LogContext) =>
        write("info", message, { ...base, ...context }),
      warn: (message: string, context?: LogContext) =>
        write("warn", message, { ...base, ...context }),
      error: (message: string, context?: LogContext) =>
        write("error", message, { ...base, ...context }),
    };
  },
};
