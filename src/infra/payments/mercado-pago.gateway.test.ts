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

describe("MercadoPagoGateway — Checkout Pro (Entrega B)", () => {
  test("createTipPayment cria preference com split + external_reference + back_urls", async () => {
    let capturedUrl = "";
    let capturedBody: any = null;
    let capturedHeaders: any = null;

    const mockFetch = (async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedBody = JSON.parse(String(init.body));
      capturedHeaders = init.headers;
      return new Response(
        JSON.stringify({
          id: "pref-98765",
          init_point: "https://mercadopago.com/checkout/v1/redirect?pref=pref-98765",
          external_reference: "req-abc",
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
      itemDescription: 'Gorjeta por "Garota de Ipanema" — Tom Jobim',
      backUrls: {
        success: "https://app.test/show/s1?payment=success",
        failure: "https://app.test/show/s1?payment=failure",
        pending: "https://app.test/show/s1?payment=pending",
      },
    });

    expect(capturedUrl).toBe("https://api.test.local/checkout/preferences");
    expect(result.paymentId).toBe("pref-98765");
    expect(result.status).toBe("pending");
    expect(result.checkoutUrl).toBe("https://mercadopago.com/checkout/v1/redirect?pref=pref-98765");

    expect(capturedBody.items[0].unit_price).toBe(10);
    expect(capturedBody.items[0].currency_id).toBe("BRL");
    expect(capturedBody.items[0].description).toBe('Gorjeta por "Garota de Ipanema" — Tom Jobim');
    expect(capturedBody.items[0].category_id).toBe("services");
    expect(capturedBody.items[0].title).toBe("Pedido musical + gorjeta");
    expect(capturedBody.marketplace_fee).toBe(1.5);
    expect(capturedBody.external_reference).toBe("req-abc");
    // default (pixOnly omitido) → PIX-only ativo: exclui todos os outros tipos
    expect(capturedBody.payment_methods.excluded_payment_types).toEqual([
      { id: "credit_card" },
      { id: "debit_card" },
      { id: "ticket" },
      { id: "atm" },
    ]);
    expect(capturedBody.payment_methods.installments).toBe(1);
    expect(capturedBody.back_urls.success).toBe("https://app.test/show/s1?payment=success");
    // auto_return: "approved" → MP redireciona automaticamente após aprovação (recomendação MP p/ subir aprovação)
    expect(capturedBody.auto_return).toBe("approved");

    expect((capturedHeaders as any)["X-Idempotency-Key"]).toBe("req-abc");
    expect((capturedHeaders as any)["Authorization"]).toBe("Bearer at-seller");
  });

  test("createTipPayment com useSandboxCheckout=true retorna sandbox_init_point", async () => {
    const mockFetch = (async () =>
      new Response(
        JSON.stringify({
          id: "pref-1",
          init_point: "https://prod.mp/checkout",
          sandbox_init_point: "https://sandbox.mp/checkout",
        }),
        { status: 201 }
      )) as unknown as typeof fetch;

    const gw = new MercadoPagoGateway({
      ...baseConfig,
      fetch: mockFetch,
      useSandboxCheckout: true,
    });
    const result = await gw.createTipPayment({
      artistExternalAccountId: "x",
      artistAccessToken: "y",
      amountInCents: 2000,
      platformFeePercent: 15,
      idempotencyKey: "k",
      itemDescription: "d",
    });
    expect(result.checkoutUrl).toBe("https://sandbox.mp/checkout");
  });

  test("createTipPayment com useSandboxCheckout=false retorna init_point (produção)", async () => {
    const mockFetch = (async () =>
      new Response(
        JSON.stringify({
          id: "pref-1",
          init_point: "https://prod.mp/checkout",
          sandbox_init_point: "https://sandbox.mp/checkout",
        }),
        { status: 201 }
      )) as unknown as typeof fetch;

    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: mockFetch });
    const result = await gw.createTipPayment({
      artistExternalAccountId: "x",
      artistAccessToken: "y",
      amountInCents: 2000,
      platformFeePercent: 15,
      idempotencyKey: "k",
      itemDescription: "d",
    });
    expect(result.checkoutUrl).toBe("https://prod.mp/checkout");
  });

  test("createTipPayment com pixOnly=false não envia excluded_payment_types", async () => {
    let capturedBody: any = null;
    const mockFetch = (async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ id: "p", init_point: "u" }), { status: 201 });
    }) as unknown as typeof fetch;

    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: mockFetch, pixOnly: false });
    await gw.createTipPayment({
      artistExternalAccountId: "x",
      artistAccessToken: "y",
      amountInCents: 500,
      platformFeePercent: 15,
      idempotencyKey: "k",
      itemDescription: "d",
    });
    expect(capturedBody.payment_methods.excluded_payment_types).toBeUndefined();
    expect(capturedBody.payment_methods.installments).toBe(1);
  });

  test("createTipPayment omite back_urls e auto_return quando back_urls não é fornecido", async () => {
    let capturedBody: any = null;
    const mockFetch = (async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ id: "p", init_point: "u" }), { status: 201 });
    }) as unknown as typeof fetch;

    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: mockFetch });
    await gw.createTipPayment({
      artistExternalAccountId: "x",
      artistAccessToken: "y",
      amountInCents: 500,
      platformFeePercent: 15,
      idempotencyKey: "k",
      itemDescription: "d",
    });
    expect(capturedBody.back_urls).toBeUndefined();
    expect(capturedBody.auto_return).toBeUndefined();
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
        itemDescription: "d",
      })
    ).rejects.toThrow("Falha ao criar preference");
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

  test("fetchPaymentStatus retorna {status, externalReference}", async () => {
    const mockFetch = (async () =>
      new Response(JSON.stringify({ status: "approved", external_reference: "req-99" }), {
        status: 200,
      })) as unknown as typeof fetch;
    const gw = new MercadoPagoGateway({ ...baseConfig, fetch: mockFetch });
    const out = await gw.fetchPaymentStatus({ paymentId: "pay-1", artistAccessToken: "at" });
    expect(out.status).toBe("approved");
    expect(out.externalReference).toBe("req-99");
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
