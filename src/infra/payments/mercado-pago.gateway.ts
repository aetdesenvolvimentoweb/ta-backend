import { BusinessRuleError } from "../../core/errors/app-error";
import type {
  CreateTipPaymentInput,
  CreateTipPaymentResult,
  FetchPaymentStatusInput,
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
  point_of_interaction?: {
    transaction_data?: {
      ticket_url?: string;
      qr_code?: string;
      qr_code_base64?: string;
    };
  };
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

  async createTipPayment(input: CreateTipPaymentInput): Promise<CreateTipPaymentResult> {
    const amountInReais = input.amountInCents / 100;
    const feeInReais = parseFloat(
      ((input.amountInCents * input.platformFeePercent) / 100 / 100).toFixed(2)
    );

    const body: Record<string, unknown> = {
      transaction_amount: amountInReais,
      description: input.description,
      payment_method_id: "pix",
      application_fee: feeInReais,
      payer: {
        email: `cliente+${input.idempotencyKey}@toqueaquela.app`,
        first_name: input.payerName ?? "Cliente",
      },
    };

    const res = await this.fetchFn(`${this.apiBaseUrl}/v1/payments`, {
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
        `Falha ao criar pagamento PIX no Mercado Pago: ${res.status} ${text}`
      );
    }

    const data = (await res.json()) as MpPaymentResponse;
    return {
      paymentId: String(data.id),
      status: this.mapPaymentStatus(data.status),
      checkoutUrl: data.point_of_interaction?.transaction_data?.ticket_url,
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

  async fetchPaymentStatus(input: FetchPaymentStatusInput): Promise<TipPaymentStatus> {
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

    const data = (await res.json()) as { status: string };
    return this.mapPaymentStatus(data.status);
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
