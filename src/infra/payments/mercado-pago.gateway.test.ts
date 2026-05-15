import { expect, test, describe } from "bun:test";
import { MercadoPagoGateway } from "./mercado-pago.gateway";

const baseConfig = {
  clientId: 'cid-123',
  clientSecret: 'csecret-xyz',
  authBaseUrl: 'https://auth.test.local',
  apiBaseUrl: 'https://api.test.local',
};

describe("MercadoPagoGateway — OAuth", () => {
  test("buildAuthorizeUrl monta querystring com PKCE quando challenge é fornecido", () => {
    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: (async () => new Response()) as any });
    const url = gw.buildAuthorizeUrl({
      state: 'st-1',
      redirectUri: 'http://localhost:3000/v1/payment-accounts/callback',
      codeChallenge: 'cc-xyz',
    });
    expect(url).toStartWith('https://auth.test.local/authorization?');
    expect(url).toContain('client_id=cid-123');
    expect(url).toContain('response_type=code');
    expect(url).toContain('state=st-1');
    expect(url).toContain('code_challenge=cc-xyz');
    expect(url).toContain('code_challenge_method=S256');
  });

  test("buildAuthorizeUrl omite PKCE quando challenge não é fornecido", () => {
    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: (async () => new Response()) as any });
    const url = gw.buildAuthorizeUrl({ state: 's', redirectUri: 'http://cb' });
    expect(url).not.toContain('code_challenge');
  });

  test("exchangeOAuthCode envia code_verifier e mapeia resposta para OAuthCredentials", async () => {
    let captured: { url: string; body: string } | null = null;
    const mockFetch = (async (url: string, init: RequestInit) => {
      captured = { url, body: String(init.body) };
      return new Response(JSON.stringify({
        access_token: 'at-1',
        refresh_token: 'rt-1',
        expires_in: 3600,
        scope: 'read write offline_access',
        user_id: 999,
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: mockFetch });
    const creds = await gw.exchangeOAuthCode({
      code: 'auth-code',
      redirectUri: 'http://cb',
      codeVerifier: 'verifier-abc',
    });

    expect(captured!.url).toBe('https://api.test.local/oauth/token');
    expect(captured!.body).toContain('grant_type=authorization_code');
    expect(captured!.body).toContain('code=auth-code');
    expect(captured!.body).toContain('code_verifier=verifier-abc');
    expect(captured!.body).toContain('client_secret=csecret-xyz');

    expect(creds.externalAccountId).toBe('999');
    expect(creds.accessToken).toBe('at-1');
    expect(creds.refreshToken).toBe('rt-1');
    expect(creds.expiresAt).toBeInstanceOf(Date);
    expect(creds.scope).toContain('offline_access');
  });

  test("exchangeOAuthCode lança BusinessRuleError em resposta não-OK", async () => {
    const mockFetch = (async () => new Response('invalid grant', { status: 400 })) as unknown as typeof fetch;
    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: mockFetch });
    await expect(gw.exchangeOAuthCode({ code: 'x', redirectUri: 'y' }))
      .rejects.toThrow("Falha na troca do código OAuth");
  });

  test("refreshAccessToken usa grant_type=refresh_token", async () => {
    let body = '';
    const mockFetch = (async (_url: string, init: RequestInit) => {
      body = String(init.body);
      return new Response(JSON.stringify({
        access_token: 'at-2',
        refresh_token: 'rt-2',
        expires_in: 7200,
        user_id: 7,
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: mockFetch });
    const creds = await gw.refreshAccessToken('old-refresh');

    expect(body).toContain('grant_type=refresh_token');
    expect(body).toContain('refresh_token=old-refresh');
    expect(creds.accessToken).toBe('at-2');
    expect(creds.externalAccountId).toBe('7');
  });

  test("createTipPayment/refundTipPayment ainda não implementados (Entrega B)", async () => {
    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: (async () => new Response()) as any });
    await expect(gw.createTipPayment({} as any)).rejects.toThrow("Entrega B");
    await expect(gw.refundTipPayment({} as any)).rejects.toThrow("Entrega B");
  });
});
