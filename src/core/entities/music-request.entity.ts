import type { TipPaymentStatus } from "../ports/payment-gateway.port";
import { Money } from "../value-objects/money.vo";
import type { PaymentGatewayName } from "../value-objects/payment-account.vo";

/**
 * Snapshot do pagamento associado a um pedido com gorjeta (RN16/RN18).
 * Não existe quando `tip.amountInCents === 0` (pedido gratuito — RN09).
 */
export interface RequestPayment {
  gateway: PaymentGatewayName;
  paymentId: string;
  status: TipPaymentStatus;
}

/**
 * Pedido de música feito pelo público.
 */
export class MusicRequest {
  constructor(
    public readonly id: string,
    public readonly showId: string,
    public readonly songId: string,
    public customerName: string,
    public readonly customerSessionId: string | null = null,
    public message: string | null = null,
    public tip: Money = new Money(0),
    public status: "pending" | "played" | "cancelled" | "refunded" = "pending",
    public readonly createdAt: Date = new Date(),
    public payment: RequestPayment | null = null
  ) {}

  markAsPlayed(): void {
    this.status = "played";
  }

  cancel(): void {
    this.status = "cancelled";
  }

  attachPayment(payment: RequestPayment): void {
    this.payment = payment;
  }

  /**
   * Substitui o `paymentId` armazenado. Usado pelo webhook quando o pagamento
   * real do MP nasce a partir de uma preference: na criação guardamos o
   * preferenceId, e ao receber a primeira notificação trocamos pelo paymentId.
   */
  upgradePaymentId(paymentId: string): void {
    if (!this.payment) return;
    this.payment = { ...this.payment, paymentId };
  }

  markPaymentStatus(status: TipPaymentStatus): void {
    if (!this.payment) return;
    this.payment = { ...this.payment, status };
    if (status === "refunded") this.status = "refunded";
  }
}
