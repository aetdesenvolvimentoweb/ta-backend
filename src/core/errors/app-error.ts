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
 *
 * Use apenas quando o token está ausente, inválido ou expirado — situações em
 * que o cliente precisa reautenticar. Para usuário autenticado mas sem permissão
 * (admin/owner), prefira `ForbiddenError`.
 */
export class UnauthorizedError extends AppError {
  public readonly code = "UNAUTHORIZED";
  public readonly statusCode = 401;
}

/**
 * Erro para falta de permissão de usuário autenticado (HTTP 403).
 *
 * Diferencia "não autenticado" de "autenticado mas sem permissão" para que o
 * frontend não trate negação de acesso como sessão expirada (e vice-versa).
 */
export class ForbiddenError extends AppError {
  public readonly code = "FORBIDDEN";
  public readonly statusCode = 403;
}
