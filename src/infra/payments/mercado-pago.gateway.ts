import { BusinessRuleError } from "../../core/errors/app-error";
import type {
  CreateTipPaymentInput,
  CreateTipPaymentResult,
  FetchPaymentStatusInput,
  FetchPaymentStatusResult,
  IPaymentGateway,
  OAuthAuthorizeUrlInput,
  OAuthCredentials,
  OAuthExchangeInput,
  RefundTipPaymentInput,
  TipPaymentStatus,
} from "../../core/ports/payment-gateway.port";
import type { PaymentGatewayName } from "../../core/value-objects/payment-account.vo";

export interface MercadoPagoConfig {
  clientId: string;
  clientSecret: string;
  /** Base do endpoint OAuth (default produção). Permite injetar mock em testes. */
  authBaseUrl?: string;
  apiBaseUrl?: string;
  /** Função `fetch` injetável para testes. */
  fetch?: typeof fetch;
  /**
   * Se true, restringe o Checkout Pro a PIX apenas (exclui cartão/conta MP/boleto/ATM).
   * Default: true (produção). Desligue em dev quando o vendedor de teste não tem PIX.
   */
  pixOnly?: boolean;
  /**
   * Se true, retorna `sandbox_init_point` da preference em vez de `init_point`. Usar em
   * dev com test users (o checkout produção dispara verificação por email que não chega).
   */
  useSandboxCheckout?: boolean;
}

interface MpTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  user_id: number | string;
}

interface MpPaymentResponse {
  id: number | string;
  status: string;
  external_reference?: string;
}

interface MpPreferenceResponse {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
  external_reference?: string;
}

/**
 * Adapter Mercado Pago — implementa `IPaymentGateway`.
 *
 * Cobertura atual: fluxo OAuth Connect (Entrega A).
 * Próxima entrega: createTipPayment + refundTipPayment (PIX + split).
 *
 * Endpoints (https://www.mercadopago.com.br/developers):
 *   - Authorize: https://auth.mercadopago.com.br/authorization
 *   - Token:     https://api.mercadopago.com/oauth/token
 */
export class MercadoPagoGateway implements IPaymentGateway {
  readonly name: PaymentGatewayName = "mercado_pago";

  private readonly authBaseUrl: string;
  private readonly apiBaseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly config: MercadoPagoConfig) {
    this.authBaseUrl = config.authBaseUrl ?? "https://auth.mercadopago.com.br";
    this.apiBaseUrl = config.apiBaseUrl ?? "https://api.mercadopago.com";
    this.fetchFn = config.fetch ?? fetch;
  }

  buildAuthorizeUrl(input: OAuthAuthorizeUrlInput): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      platform_id: "mp",
      state: input.state,
      redirect_uri: input.redirectUri,
    });
    if (input.codeChallenge) {
      params.set("code_challenge", input.codeChallenge);
      params.set("code_challenge_method", "S256");
    }
    return `${this.authBaseUrl}/authorization?${params.toString()}`;
  }

  async exchangeOAuthCode(input: OAuthExchangeInput): Promise<OAuthCredentials> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    });
    if (input.codeVerifier) body.set("code_verifier", input.codeVerifier);

    const res = await this.fetchFn(`${this.apiBaseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BusinessRuleError(
        `Falha na troca do código OAuth com o Mercado Pago: ${res.status} ${text}`
      );
    }

    const data = (await res.json()) as MpTokenResponse;
    return this.toCredentials(data);
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthCredentials> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: refreshToken,
    });

    const res = await this.fetchFn(`${this.apiBaseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BusinessRuleError(`Falha ao renovar token Mercado Pago: ${res.status} ${text}`);
    }

    const data = (await res.json()) as MpTokenResponse;
    return this.toCredentials(data);
  }

  /**
   * Cria uma preference do Checkout Pro (hospedado). Não cria pagamento direto:
   * o cliente conclui na página do MP (PIX/cartão/boleto), e o pagamento real
   * nasce quando ele paga — o webhook então reconcilia via `external_reference`.
   *
   * Retorna o `preferenceId` no campo `paymentId` (será substituído pelo
   * paymentId real quando o webhook chegar).
   */
  async createTipPayment(input: CreateTipPaymentInput): Promise<CreateTipPaymentResult> {
    const amountInReais = input.amountInCents / 100;
    const feeInReais = parseFloat(
      ((input.amountInCents * input.platformFeePercent) / 100 / 100).toFixed(2)
    );

    // statement_descriptor: nome do artista normalizado, max 13 chars (aparece na fatura do cartão).
    const descriptor = input.artistName
      ? input.artistName
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") // remove acentos
          .replace(/[^a-zA-Z0-9 ]/g, "") // só alfanumérico + espaço
          .substring(0, 13)
          .trim()
          .toUpperCase()
      : "TOQUEAQUELA";

    const body: Record<string, unknown> = {
      items: [
        {
          id: input.idempotencyKey,
          title: input.description,
          quantity: 1,
          unit_price: amountInReais,
          currency_id: "BRL",
        },
      ],
      marketplace_fee: feeInReais,
      external_reference: input.idempotencyKey,
      statement_descriptor: descriptor,
      payment_methods: {
        // Quando pixOnly: exclui cartão/débito/boleto/ATM — sobra PIX (bank_transfer) + saldo MP.
        // Nota: account_money NÃO pode ser excluído no modelo Connect/Marketplace do MP.
        ...(this.config.pixOnly !== false
          ? {
              excluded_payment_types: [
                { id: "credit_card" },
                { id: "debit_card" },
                { id: "ticket" },
                { id: "atm" },
              ],
            }
          : {}),
        installments: 1,
      },
      ...(input.backUrls ? { back_urls: input.backUrls } : {}),
    };

    const res = await this.fetchFn(`${this.apiBaseUrl}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.artistAccessToken}`,
        "X-Idempotency-Key": input.idempotencyKey,
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BusinessRuleError(
        `Falha ao criar preference no Mercado Pago: ${res.status} ${text}`
      );
    }

    const data = (await res.json()) as MpPreferenceResponse;
    const checkoutUrl = this.config.useSandboxCheckout
      ? (data.sandbox_init_point ?? data.init_point)
      : data.init_point;
    return {
      paymentId: data.id,
      status: "pending",
      checkoutUrl,
      raw: data,
    };
  }

  async refundTipPayment(input: RefundTipPaymentInput): Promise<void> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (input.artistAccessToken) {
      headers["Authorization"] = `Bearer ${input.artistAccessToken}`;
    }

    const res = await this.fetchFn(`${this.apiBaseUrl}/v1/payments/${input.paymentId}/refunds`, {
      method: "POST",
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BusinessRuleError(
        `Falha ao estornar pagamento ${input.paymentId} no Mercado Pago: ${res.status} ${text}`
      );
    }
  }

  async fetchPaymentStatus(input: FetchPaymentStatusInput): Promise<FetchPaymentStatusResult> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (input.artistAccessToken) {
      headers["Authorization"] = `Bearer ${input.artistAccessToken}`;
    }

    const res = await this.fetchFn(`${this.apiBaseUrl}/v1/payments/${input.paymentId}`, {
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BusinessRuleError(
        `Falha ao buscar status do pagamento ${input.paymentId}: ${res.status} ${text}`
      );
    }

    const data = (await res.json()) as MpPaymentResponse;
    return {
      status: this.mapPaymentStatus(data.status),
      externalReference: data.external_reference,
    };
  }

  private mapPaymentStatus(status: string): TipPaymentStatus {
    switch (status) {
      case "approved":
        return "approved";
      case "refunded":
        return "refunded";
      case "rejected":
      case "cancelled":
        return "rejected";
      default:
        return "pending";
    }
  }

  private toCredentials(data: MpTokenResponse): OAuthCredentials {
    return {
      externalAccountId: String(data.user_id),
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt:
        typeof data.expires_in === "number" ? new Date(Date.now() + data.expires_in * 1000) : null,
      scope: data.scope,
    };
  }
}
