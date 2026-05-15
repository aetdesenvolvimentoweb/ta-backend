import type { PaymentGatewayName } from "../value-objects/payment-account.vo";

export type TipPaymentStatus = 'pending' | 'approved' | 'rejected' | 'refunded';

export interface OAuthAuthorizeUrlInput {
  state: string;
  redirectUri: string;
}

export interface OAuthExchangeInput {
  code: string;
  redirectUri: string;
}

export interface OAuthCredentials {
  externalAccountId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope?: string;
}

export interface CreateTipPaymentInput {
  /** Conta externa do artista (collector) que recebe a parte líquida. */
  artistExternalAccountId: string;
  /** Token OAuth do artista (já descriptografado pelo caller). */
  artistAccessToken: string;
  /** Valor bruto em centavos antes do split. */
  amountInCents: number;
  /** Percentual destinado à plataforma (0..100). */
  platformFeePercent: number;
  /** Identificador idempotente para este pagamento (ex.: musicRequest.id). */
  idempotencyKey: string;
  /** Nome/apelido do pagador para registro no gateway (opcional). */
  payerName?: string;
  description: string;
}

export interface CreateTipPaymentResult {
  paymentId: string;
  status: TipPaymentStatus;
  /** URL de checkout (PIX QR ou redirect), quando aplicável. */
  checkoutUrl?: string;
  /** Payload bruto do gateway para auditoria/debug (não vai pro domínio). */
  raw?: unknown;
}

export interface RefundTipPaymentInput {
  paymentId: string;
  /** Token do artista (opcional para alguns gateways). */
  artistAccessToken?: string;
}

/**
 * Port agnóstico de gateway de pagamento (RN14).
 *
 * Adapters concretos: MercadoPagoGateway, StripeGateway, PagarmeGateway etc.
 * Use cases dependem APENAS deste contrato — nunca importam SDKs específicos.
 */
export interface IPaymentGateway {
  readonly name: PaymentGatewayName;

  /** Gera URL OAuth para o artista autorizar a plataforma. */
  buildAuthorizeUrl(input: OAuthAuthorizeUrlInput): string;

  /** Troca o `code` do callback OAuth por tokens + identificação da conta. */
  exchangeOAuthCode(input: OAuthExchangeInput): Promise<OAuthCredentials>;

  /** Renova `accessToken` usando o `refreshToken`. */
  refreshAccessToken(refreshToken: string): Promise<OAuthCredentials>;

  /** Cria um pagamento com split nativo (RN16). */
  createTipPayment(input: CreateTipPaymentInput): Promise<CreateTipPaymentResult>;

  /** Estorna um pagamento previamente aprovado (RN18). */
  refundTipPayment(input: RefundTipPaymentInput): Promise<void>;
}

/**
 * Registry para resolver adapters por nome (RN14).
 * Os use cases pedem `registry.get('mercado_pago')` em vez de injetar adapters concretos.
 */
export interface IPaymentGatewayRegistry {
  get(name: PaymentGatewayName): IPaymentGateway;
  list(): readonly PaymentGatewayName[];
}
