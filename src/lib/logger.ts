/**
 * Structured logging utility for consistent error handling
 */

export interface LogContext {
  [key: string]: unknown;
}

export const logger = {
  error: (message: string, error?: unknown, context?: LogContext) => {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error(`[${timestamp}] ERROR: ${message}`, {
      error: errorMessage,
      ...(errorStack && { stack: errorStack }),
      ...context,
    });
  },

  warn: (message: string, context?: LogContext) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] WARN: ${message}`, context);
  },

  info: (message: string, context?: LogContext) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] INFO: ${message}`, context);
  },
};
