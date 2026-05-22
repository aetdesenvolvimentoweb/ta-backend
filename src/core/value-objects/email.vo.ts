import { BusinessRuleError } from "../errors/app-error";

/**
 * Value Object que representa um e-mail válido.
 * @class Email
 */
export class Email {
  private readonly value: string;

  /**
   * @param {string} email - Endereço de e-mail bruto.
   * @throws BusinessRuleError se o e-mail for inválido.
   */
  constructor(email: string) {
    if (!this.validate(email)) {
      throw new BusinessRuleError(`E-mail inválido: ${email}`);
    }
    this.value = email.toLowerCase().trim();
  }

  /**
   * Valida o formato do e-mail usando regex simples.
   * @param {string} email
   * @returns {boolean}
   */
  private validate(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  /**
   * Retorna o valor do e-mail.
   * @returns {string}
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Compara se dois objetos de e-mail são iguais.
   * @param {Email} other
   * @returns {boolean}
   */
  equals(other: Email): boolean {
    return this.value === other.getValue();
  }
}
