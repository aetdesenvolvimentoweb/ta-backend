import { BusinessRuleError } from "../errors/app-error";

export type PaymentGatewayName = 'mercado_pago' | 'stripe' | 'pagarme';

const SUPPORTED: ReadonlySet<PaymentGatewayName> = new Set([
  'mercado_pago',
  'stripe',
  'pagarme',
]);

export function isSupportedGateway(name: string): name is PaymentGatewayName {
  return SUPPORTED.has(name as PaymentGatewayName);
}

/**
 * Vinculação do artista a uma conta de um gateway de pagamento.
 *
 * RN14: agnóstico de gateway.
 * RN17: guarda apenas o identificador externo opaco — sem CPF, conta bancária ou PIX.
 */
export class PaymentAccount {
  public readonly externalAccountId: string;

  constructor(
    public readonly gateway: PaymentGatewayName,
    externalAccountId: string,
    public readonly connectedAt: Date = new Date()
  ) {
    if (!isSupportedGateway(gateway)) {
      throw new BusinessRuleError(`Gateway de pagamento não suportado: ${gateway}`);
    }
    const trimmed = externalAccountId?.trim();
    if (!trimmed) {
      throw new BusinessRuleError("externalAccountId é obrigatório para vincular uma conta de pagamento.");
    }
    this.externalAccountId = trimmed;
  }
}
