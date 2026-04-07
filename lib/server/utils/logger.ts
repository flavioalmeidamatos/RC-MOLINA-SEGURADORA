type LogContext = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", message: string, context?: LogContext) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  info(message: string, context?: LogContext) {
    emit("info", message, context);
  },

  warn(message: string, context?: LogContext) {
    emit("warn", message, context);
  },

  error(message: string, error?: unknown, context?: LogContext) {
    emit("error", message, {
      ...context,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
    });
  },

  async time<T>(message: string, context: LogContext, fn: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();

    try {
      const result = await fn();
      emit("info", `${message}_done`, {
        ...context,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return result;
    } catch (error) {
      emit("error", `${message}_failed`, {
        ...context,
        durationMs: Math.round(performance.now() - startedAt),
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : error,
      });
      throw error;
    }
  },
};
