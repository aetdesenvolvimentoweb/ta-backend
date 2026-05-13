/**
 * Interface para o sistema de logs da aplicação.
 * Permite o desacoplamento de bibliotecas externas (Pino, Winston, etc).
 */
export interface ILogger {
  info(message: string, context?: any): void;
  error(message: string, error?: any, context?: any): void;
  warn(message: string, context?: any): void;
  debug(message: string, context?: any): void;
}
