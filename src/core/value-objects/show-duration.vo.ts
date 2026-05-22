import { BusinessRuleError } from "../errors/app-error";

/**
 * Value Object que valida a duração permitida para um show (RN01).
 * @class ShowDuration
 */
export class ShowDuration {
  /**
   * @param {number} hours - Duração em horas.
   * @throws BusinessRuleError se estiver fora do range [1, 24].
   */
  constructor(public readonly hours: number) {
    if (!Number.isInteger(hours) || hours < 1 || hours > 24) {
      throw new BusinessRuleError(
        "A duração do show deve ser um inteiro entre 1 e 24 horas (RN01)."
      );
    }
  }

  /**
   * Converte a duração para milissegundos (útil para cálculos de expiração).
   * @returns {number}
   */
  toMilliseconds(): number {
    return this.hours * 60 * 60 * 1000;
  }
}
