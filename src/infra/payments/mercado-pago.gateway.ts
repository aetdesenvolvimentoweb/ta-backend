import { BusinessRuleError } from "../../core/errors/app-error";
import type {
  CreateTipPaymentInput,
  CreateTipPaymentResult,
  IPaymentGateway,
  OAuthAuthorizeUrlInput,
  OAuthCredentials,
  OAuthExchangeInput,
  RefundTipPaymentInput,
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
  readonly name: PaymentGatewayName = 'mercado_pago';

  private readonly authBaseUrl: string;
  private readonly apiBaseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly config: MercadoPagoConfig) {
    this.authBaseUrl = config.authBaseUrl ?? 'https://auth.mercadopago.com.br';
    this.apiBaseUrl = config.apiBaseUrl ?? 'https://api.mercadopago.com';
    this.fetchFn = config.fetch ?? fetch;
  }

  buildAuthorizeUrl(input: OAuthAuthorizeUrlInput): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      platform_id: 'mp',
      state: input.state,
      redirect_uri: input.redirectUri,
    });
    if (input.codeChallenge) {
      params.set('code_challenge', input.codeChallenge);
      params.set('code_challenge_method', 'S256');
    }
    return `${this.authBaseUrl}/authorization?${params.toString()}`;
  }

  async exchangeOAuthCode(input: OAuthExchangeInput): Promise<OAuthCredentials> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    });
    if (input.codeVerifier) body.set('code_verifier', input.codeVerifier);

    const res = await this.fetchFn(`${this.apiBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BusinessRuleError(`Falha na troca do código OAuth com o Mercado Pago: ${res.status} ${text}`);
    }

    const data = (await res.json()) as MpTokenResponse;
    return this.toCredentials(data);
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthCredentials> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: refreshToken,
    });

    const res = await this.fetchFn(`${this.apiBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
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

  async createTipPayment(_input: CreateTipPaymentInput): Promise<CreateTipPaymentResult> {
    throw new BusinessRuleError(
      'createTipPayment ainda não implementado para Mercado Pago (Entrega B).'
    );
  }

  async refundTipPayment(_input: RefundTipPaymentInput): Promise<void> {
    throw new BusinessRuleError(
      'refundTipPayment ainda não implementado para Mercado Pago (Entrega B).'
    );
  }

  private toCredentials(data: MpTokenResponse): OAuthCredentials {
    return {
      externalAccountId: String(data.user_id),
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: typeof data.expires_in === 'number'
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
      scope: data.scope,
    };
  }
}
