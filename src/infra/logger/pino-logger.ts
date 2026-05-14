import pino from "pino";
import type { Logger as PinoInstance } from "pino";
import type { ILogger } from "../../core/ports/logger.port";

/**
 * Implementação do ILogger utilizando a biblioteca Pino.
 * Oferece alta performance e logs estruturados (JSON).
 */
export class PinoLogger implements ILogger {
  private logger: PinoInstance;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || "info",
      transport: process.env.NODE_ENV !== "production" 
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          }
        : undefined,
    });
  }

  info(message: string, context?: any): void {
    this.logger.info(context, message);
  }

  error(message: string, error?: any, context?: any): void {
    this.logger.error({ ...context, err: error }, message);
  }

  warn(message: string, context?: any): void {
    this.logger.warn(context, message);
  }

  debug(message: string, context?: any): void {
    this.logger.debug(context, message);
  }
}
