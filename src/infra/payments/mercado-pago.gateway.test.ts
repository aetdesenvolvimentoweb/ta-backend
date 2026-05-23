import { describe, expect, test } from "bun:test";
import { MercadoPagoGateway } from "./mercado-pago.gateway";

const baseConfig = {
  clientId: "cid-123",
  clientSecret: "csecret-xyz",
  authBaseUrl: "https://auth.test.local",
  apiBaseUrl: "https://api.test.local",
};

describe("MercadoPagoGateway — OAuth", () => {
  test("buildAuthorizeUrl monta querystring com PKCE quando challenge é fornecido", () => {
    const gw = new MercadoPagoGateway({
      ...baseConfig,
      fetch: (async () => new Response()) as any,
    });
    const url = gw.buildAuthorizeUrl({
      state: "st-1",
      redirectUri: "http://localhost:3000/v1/payment-accounts/callback",
      codeChallenge: "cc-xyz",
    });
    expect(url).toStartWith("https://auth.test.local/authorization?");
    expect(url).toContain("client_id=cid-123");
    expect(url).toContain("response_type=code");
    expect(url).toContain("state=st-1");
    expect(url).toContain("code_challenge=cc-xyz");
    expect(url).toContain("code_challenge_method=S256");
  });

  test("buildAuthorizeUrl omite PKCE quando challenge não é fornecido", () => {
    const gw = new MercadoPagoGateway({
      ...baseConfig,
      fetch: (async () => new Response()) as any,
    });
    const url = gw.buildAuthorizeUrl({ state: "s", redirectUri: "http://cb" });
    expect(url).not.toContain("code_challenge");
  });

  test("exchangeOAuthCode envia code_verifier e mapeia resposta para OAuthCredentials", async () => {
    let captured: { url: string; body: string } | null = null;
    const mockFetch = (async (url: string, init: RequestInit) => {
      captured = { url, body: String(init.body) };
      return new Response(
        JSON.stringify({
          access_token: "at-1",
          refresh_token: "rt-1",
          expires_in: 3600,
          scope: "read write offline_access",
          user_id: 999,
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: mockFetch });
    const creds = await gw.exchangeOAuthCode({
      code: "auth-code",
      redirectUri: "http://cb",
      codeVerifier: "verifier-abc",
    });

    expect(captured!.url).toBe("https://api.test.local/oauth/token");
    expect(captured!.body).toContain("grant_type=authorization_code");
    expect(captured!.body).toContain("code=auth-code");
    expect(captured!.body).toContain("code_verifier=verifier-abc");
    expect(captured!.body).toContain("client_secret=csecret-xyz");

    expect(creds.externalAccountId).toBe("999");
    expect(creds.accessToken).toBe("at-1");
    expect(creds.refreshToken).toBe("rt-1");
    expect(creds.expiresAt).toBeInstanceOf(Date);
    expect(creds.scope).toContain("offline_access");
  });

  test("exchangeOAuthCode lança BusinessRuleError em resposta não-OK", async () => {
    const mockFetch = (async () =>
      new Response("invalid grant", { status: 400 })) as unknown as typeof fetch;
    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: mockFetch });
    await expect(gw.exchangeOAuthCode({ code: "x", redirectUri: "y" })).rejects.toThrow(
      "Falha na troca do código OAuth"
    );
  });

  test("refreshAccessToken usa grant_type=refresh_token", async () => {
    let body = "";
    const mockFetch = (async (_url: string, init: RequestInit) => {
      body = String(init.body);
      return new Response(
        JSON.stringify({
          access_token: "at-2",
          refresh_token: "rt-2",
          expires_in: 7200,
          user_id: 7,
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: mockFetch });
    const creds = await gw.refreshAccessToken("old-refresh");

    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("refresh_token=old-refresh");
    expect(creds.accessToken).toBe("at-2");
    expect(creds.externalAccountId).toBe("7");
  });
});

describe("MercadoPagoGateway — Pagamento PIX (Entrega B)", () => {
  test("createTipPayment envia payload correto com split nativo e retorna paymentId + checkoutUrl", async () => {
    let capturedBody: any = null;
    let capturedHeaders: any = null;

    const mockFetch = (async (url: string, init: RequestInit) => {
      capturedBody = JSON.parse(String(init.body));
      capturedHeaders = init.headers;
      return new Response(
        JSON.stringify({
          id: 98765,
          status: "pending",
          point_of_interaction: {
            transaction_data: {
              ticket_url: "https://mercadopago.com/pix/qr/test",
            },
          },
        }),
        { status: 201 }
      );
    }) as unknown as typeof fetch;

    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: mockFetch });
    const result = await gw.createTipPayment({
      artistExternalAccountId: "mp-ext-1",
      artistAccessToken: "at-seller",
      amountInCents: 1000,
      platformFeePercent: 15,
      idempotencyKey: "req-abc",
      payerName: "Maria",
      description: "Gorjeta - Toque Aquela",
    });

    expect(result.paymentId).toBe("98765");
    expect(result.status).toBe("pending");
    expect(result.checkoutUrl).toBe("https://mercadopago.com/pix/qr/test");

    expect(capturedBody.payment_method_id).toBe("pix");
    expect(capturedBody.transaction_amount).toBe(10); // 1000 centavos = 10 reais
    expect(capturedBody.application_fee).toBe(1.5); // 15% de 10 = 1.5
    expect(capturedBody.payer.first_name).toBe("Maria");
    expect(capturedBody.payer.email).toBe("cliente+req-abc@toqueaquela.app");

    expect((capturedHeaders as any)["X-Idempotency-Key"]).toBe("req-abc");
    expect((capturedHeaders as any)["Authorization"]).toBe("Bearer at-seller");
  });

  test("createTipPayment lança BusinessRuleError em resposta não-OK", async () => {
    const mockFetch = (async () =>
      new Response("bad request", { status: 400 })) as unknown as typeof fetch;
    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: mockFetch });
    await expect(
      gw.createTipPayment({
        artistExternalAccountId: "x",
        artistAccessToken: "y",
        amountInCents: 100,
        platformFeePercent: 15,
        idempotencyKey: "k",
        description: "d",
      })
    ).rejects.toThrow("Falha ao criar pagamento PIX");
  });

  test("createTipPayment mapeia status 'approved' corretamente", async () => {
    const mockFetch = (async () =>
      new Response(
        JSON.stringify({
          id: 1,
          status: "approved",
        }),
        { status: 201 }
      )) as unknown as typeof fetch;

    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: mockFetch });
    const result = await gw.createTipPayment({
      artistExternalAccountId: "x",
      artistAccessToken: "y",
      amountInCents: 500,
      platformFeePercent: 15,
      idempotencyKey: "k",
      description: "d",
    });
    expect(result.status).toBe("approved");
  });

  test("refundTipPayment chama o endpoint correto com access token", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedAuth = "";

    const mockFetch = (async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedMethod = String(init.method);
      capturedAuth = (init.headers as any)?.["Authorization"] ?? "";
      return new Response(JSON.stringify({ id: 1, status: "approved" }), { status: 201 });
    }) as unknown as typeof fetch;

    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: mockFetch });
    await gw.refundTipPayment({ paymentId: "pay-123", artistAccessToken: "at-seller" });

    expect(capturedUrl).toBe("https://api.test.local/v1/payments/pay-123/refunds");
    expect(capturedMethod).toBe("POST");
    expect(capturedAuth).toBe("Bearer at-seller");
  });

  test("refundTipPayment lança BusinessRuleError em resposta não-OK", async () => {
    const mockFetch = (async () =>
      new Response("error", { status: 422 })) as unknown as typeof fetch;
    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: mockFetch });
    await expect(
      gw.refundTipPayment({ paymentId: "p-1", artistAccessToken: "at" })
    ).rejects.toThrow("Falha ao estornar pagamento");
  });

  test("fetchPaymentStatus retorna status mapeado do gateway", async () => {
    const mockFetch = (async () =>
      new Response(JSON.stringify({ status: "approved" }), {
        status: 200,
      })) as unknown as typeof fetch;
    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: mockFetch });
    const status = await gw.fetchPaymentStatus({ paymentId: "pay-1", artistAccessToken: "at" });
    expect(status).toBe("approved");
  });

  test("fetchPaymentStatus lança BusinessRuleError em resposta não-OK", async () => {
    const mockFetch = (async () =>
      new Response("not found", { status: 404 })) as unknown as typeof fetch;
    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: mockFetch });
    await expect(gw.fetchPaymentStatus({ paymentId: "pay-x" })).rejects.toThrow(
      "Falha ao buscar status"
    );
  });
});
