/**
 * Classe base para todos os erros da aplicação.
 * Permite identificar se um erro foi gerado intencionalmente pelo domínio.
 */
export abstract class AppError extends Error {
  public abstract readonly code: string;
  public abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Erro para violações de regras de negócio (HTTP 400).
 */
export class BusinessRuleError extends AppError {
  public readonly code = "BUSINESS_RULE_VIOLATION";
  public readonly statusCode = 400;
}

/**
 * Erro para recursos não encontrados (HTTP 404).
 */
export class NotFoundError extends AppError {
  public readonly code = "NOT_FOUND";
  public readonly statusCode = 404;
}

/**
 * Erro para falhas de autenticação (HTTP 401).
 */
export class UnauthorizedError extends AppError {
  public readonly code = "UNAUTHORIZED";
  public readonly statusCode = 401;
}
