import type { Email } from "../value-objects/email.vo";
import type { PaymentAccount } from "../value-objects/payment-account.vo";

/**
 * Representa um artista na plataforma Toque Aquela.
 */
export class Artist {
  constructor(
    public readonly id: string,
    public name: string,
    public readonly email: Email,
    public passwordHash?: string,
    public socials: Record<string, string> = {},
    public isPremium: boolean = false,
    public paymentAccount?: PaymentAccount
  ) {}

  updateSocials(newSocials: Record<string, string>): void {
    this.socials = { ...this.socials, ...newSocials };
  }

  setPremiumStatus(status: boolean): void {
    this.isPremium = status;
  }

  /**
   * RN15: artista só pode receber gorjetas se houver conta de pagamento conectada.
   * Pedido gratuito (RN09) continua independente disso.
   */
  canReceiveTips(): boolean {
    return this.paymentAccount !== undefined;
  }

  connectPaymentAccount(account: PaymentAccount): void {
    this.paymentAccount = account;
  }

  disconnectPaymentAccount(): void {
    this.paymentAccount = undefined;
  }
}
