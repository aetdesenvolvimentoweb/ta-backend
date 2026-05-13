/**
 * Value Object para lidar com valores monetários de forma segura (em centavos).
 * Evita erros de precisão de ponto flutuante.
 * @class Money
 */
export class Money {
  /**
   * @param {number} amountInCents - O valor total em centavos (ex: R$ 10,00 = 1000).
   * @throws Error se o valor for negativo.
   */
  constructor(public readonly amountInCents: number) {
    if (amountInCents < 0) {
      throw new Error("O valor monetário não pode ser negativo.");
    }
    
    if (!Number.isInteger(amountInCents)) {
      throw new Error("O valor em centavos deve ser um número inteiro.");
    }
  }

  /**
   * Retorna o valor formatado em Reais (R$).
   * @returns {number}
   */
  toReal(): number {
    return this.amountInCents / 100;
  }

  /**
   * Soma outro valor monetário.
   * @param {Money} other 
   * @returns {Money}
   */
  add(other: Money): Money {
    return new Money(this.amountInCents + other.amountInCents);
  }

  /**
   * Subtrai outro valor monetário.
   * @param {Money} other 
   * @returns {Money}
   */
  subtract(other: Money): Money {
    return new Money(this.amountInCents - other.amountInCents);
  }
}
