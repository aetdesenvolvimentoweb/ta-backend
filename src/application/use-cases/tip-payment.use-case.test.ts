import { expect, test, describe, mock } from "bun:test";
import { CreateTipPaymentUseCase, RefundTipPaymentUseCase } from "./tip-payment.use-case";
import { MusicRequest } from "../../core/entities/music-request.entity";
import { Show } from "../../core/entities/show.entity";
import { Artist } from "../../core/entities/artist.entity";
import { Email } from "../../core/value-objects/email.vo";
import { Money } from "../../core/value-objects/money.vo";
import { ShowDuration } from "../../core/value-objects/show-duration.vo";
import { PaymentAccount } from "../../core/value-objects/payment-account.vo";

const mockLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

function makeArtistWithPayment() {
  const artist = new Artist("artist-1", "DJ Ana", new Email("ana@test.com"));
  artist.connectPaymentAccount(new PaymentAccount("mercado_pago", "mp-ext-123"));
  return artist;
}

function makeShow() {
  return new Show("show-1", "artist-1", new Date(), new ShowDuration(4), "active");
}

function makeRequestWithTip(paymentStatus?: import("../../core/ports/payment-gateway.port").TipPaymentStatus) {
  const req = new MusicRequest("req-1", "show-1", "song-1", "João", "sess-1", null, new Money(500));
  if (paymentStatus) {
    req.attachPayment({ gateway: "mercado_pago", paymentId: "pay-99", status: paymentStatus });
  }
  return req;
}

class MockRequestRepo {
  requests = new Map<string, MusicRequest>();
  byPaymentId = new Map<string, MusicRequest>();

  async findById(id: string) { return this.requests.get(id) ?? null; }
  async findByPaymentId(paymentId: string) { return this.byPaymentId.get(paymentId) ?? null; }
  async save(r: MusicRequest) {
    this.requests.set(r.id, r);
    if (r.payment?.paymentId) this.byPaymentId.set(r.payment.paymentId, r);
  }
  async findByShowId() { return []; }
  async countFreeRequestsByCustomer() { return 0; }
  async updateStatusBySong() {}
  async aggregateAppMetrics() { return { totalVolumeCents: 0, topSongsByRequestCount: [], topArtistsByRevenue: [] }; }
  async aggregateArtistMetrics() { return { totalEarnedCents: 0, totalRequestsPlayed: 0 }; }
}

class MockShowRepo {
  shows = new Map<string, Show>();
  async findById(id: string) { return this.shows.get(id) ?? null; }
  async save() {}
  async findActiveByArtistId() { return null; }
  async findAll() { return []; }
  async markExpiredShows() {}
}

class MockArtistRepo {
  artists = new Map<string, Artist>();
  async findById(id: string) { return this.artists.get(id) ?? null; }
  async findByEmail() { return null; }
  async save() {}
}

class MockCredsRepo {
  creds: any = null;
  async findByArtistId() { return this.creds; }
  async save(c: any) { this.creds = c; }
  async deleteByArtistId() { this.creds = null; }
}

const buildMockGateway = (overrides?: Partial<any>) => ({
  name: "mercado_pago",
  buildAuthorizeUrl: () => "",
  exchangeOAuthCode: async () => ({} as any),
  refreshAccessToken: async () => ({} as any),
  createTipPayment: async () => ({
    paymentId: "pay-1",
    status: "pending" as const,
    checkoutUrl: "https://pix.test/qr",
  }),
  refundTipPayment: async () => {},
  fetchPaymentStatus: async () => "pending" as const,
  ...overrides,
});

class MockRegistry {
  constructor(private gw: any) {}
  get() { return this.gw; }
  list() { return ["mercado_pago" as const]; }
}

// ── CreateTipPaymentUseCase ────────────────────────────────────────

describe("CreateTipPaymentUseCase", () => {
  test("cria pagamento PIX e anexa ao request", async () => {
    const reqRepo = new MockRequestRepo();
    const showRepo = new MockShowRepo();
    const artistRepo = new MockArtistRepo();
    const credsRepo = new MockCredsRepo();

    const req = makeRequestWithTip();
    reqRepo.requests.set(req.id, req);
    showRepo.shows.set("show-1", makeShow());
    artistRepo.artists.set("artist-1", makeArtistWithPayment());
    credsRepo.creds = { artistId: "artist-1", gateway: "mercado_pago", accessToken: "at-1", refreshToken: null, expiresAt: null };

    const gw = buildMockGateway();
    const useCase = new CreateTipPaymentUseCase(
      reqRepo as any, showRepo as any, artistRepo as any,
      credsRepo as any, new MockRegistry(gw) as any, mockLogger as any
    );

    const result = await useCase.execute({ musicRequestId: "req-1" });

    expect(result.paymentId).toBe("pay-1");
    expect(result.status).toBe("pending");
    expect(result.checkoutUrl).toBe("https://pix.test/qr");

    const saved = await reqRepo.findById("req-1");
    expect(saved?.payment?.paymentId).toBe("pay-1");
    expect(saved?.payment?.gateway).toBe("mercado_pago");
  });

  test("é idempotente — retorna payment existente sem chamar o gateway novamente", async () => {
    const reqRepo = new MockRequestRepo();
    const showRepo = new MockShowRepo();
    const artistRepo = new MockArtistRepo();
    const credsRepo = new MockCredsRepo();

    const req = makeRequestWithTip("approved");
    reqRepo.requests.set(req.id, req);

    let gatewayCallCount = 0;
    const gw = buildMockGateway({
      createTipPayment: async () => { gatewayCallCount++; return { paymentId: "new", status: "pending" as const }; }
    });

    const useCase = new CreateTipPaymentUseCase(
      reqRepo as any, showRepo as any, artistRepo as any,
      credsRepo as any, new MockRegistry(gw) as any, mockLogger as any
    );

    const result = await useCase.execute({ musicRequestId: "req-1" });
    expect(result.paymentId).toBe("pay-99");
    expect(gatewayCallCount).toBe(0);
  });

  test("lança NotFound quando pedido não existe", async () => {
    const reqRepo = new MockRequestRepo();
    const useCase = new CreateTipPaymentUseCase(
      reqRepo as any, new MockShowRepo() as any, new MockArtistRepo() as any,
      new MockCredsRepo() as any, new MockRegistry(buildMockGateway()) as any, mockLogger as any
    );
    await expect(useCase.execute({ musicRequestId: "nope" })).rejects.toThrow("não encontrado");
  });

  test("lança BusinessRuleError quando artista não tem conta de pagamento", async () => {
    const reqRepo = new MockRequestRepo();
    const showRepo = new MockShowRepo();
    const artistRepo = new MockArtistRepo();

    const req = makeRequestWithTip();
    reqRepo.requests.set(req.id, req);
    showRepo.shows.set("show-1", makeShow());
    artistRepo.artists.set("artist-1", new Artist("artist-1", "DJ", new Email("dj@test.com")));

    const useCase = new CreateTipPaymentUseCase(
      reqRepo as any, showRepo as any, artistRepo as any,
      new MockCredsRepo() as any, new MockRegistry(buildMockGateway()) as any, mockLogger as any
    );
    await expect(useCase.execute({ musicRequestId: "req-1" })).rejects.toThrow("sem conta de pagamento");
  });
});

// ── RefundTipPaymentUseCase ────────────────────────────────────────

describe("RefundTipPaymentUseCase", () => {
  test("estorna pagamento aprovado e marca request como refunded", async () => {
    const reqRepo = new MockRequestRepo();
    const showRepo = new MockShowRepo();
    const credsRepo = new MockCredsRepo();

    const req = makeRequestWithTip("approved");
    reqRepo.requests.set(req.id, req);
    showRepo.shows.set("show-1", makeShow());
    credsRepo.creds = { artistId: "artist-1", gateway: "mercado_pago", accessToken: "at-1", refreshToken: null, expiresAt: null };

    let refundCalled = false;
    const gw = buildMockGateway({ refundTipPayment: async () => { refundCalled = true; } });

    const useCase = new RefundTipPaymentUseCase(
      reqRepo as any, showRepo as any, credsRepo as any,
      new MockRegistry(gw) as any, mockLogger as any
    );

    await useCase.execute({ musicRequestId: "req-1" });

    expect(refundCalled).toBe(true);
    const saved = await reqRepo.findById("req-1");
    expect(saved?.status).toBe("refunded");
    expect(saved?.payment?.status).toBe("refunded");
  });

  test("cancela sem estornar quando não há pagamento aprovado", async () => {
    const reqRepo = new MockRequestRepo();
    const showRepo = new MockShowRepo();

    const req = makeRequestWithTip("pending");
    reqRepo.requests.set(req.id, req);

    let refundCalled = false;
    const gw = buildMockGateway({ refundTipPayment: async () => { refundCalled = true; } });

    const useCase = new RefundTipPaymentUseCase(
      reqRepo as any, showRepo as any, new MockCredsRepo() as any,
      new MockRegistry(gw) as any, mockLogger as any
    );

    await useCase.execute({ musicRequestId: "req-1" });

    expect(refundCalled).toBe(false);
    const saved = await reqRepo.findById("req-1");
    expect(saved?.status).toBe("cancelled");
  });

  test("cancela sem estornar quando request não tem payment", async () => {
    const reqRepo = new MockRequestRepo();
    const req = new MusicRequest("req-1", "show-1", "song-1", "João", "sess-1", null, new Money(0));
    reqRepo.requests.set(req.id, req);

    const useCase = new RefundTipPaymentUseCase(
      reqRepo as any, new MockShowRepo() as any, new MockCredsRepo() as any,
      new MockRegistry(buildMockGateway()) as any, mockLogger as any
    );

    await useCase.execute({ musicRequestId: "req-1" });
    const saved = await reqRepo.findById("req-1");
    expect(saved?.status).toBe("cancelled");
  });

  test("lança NotFound quando pedido não existe", async () => {
    const useCase = new RefundTipPaymentUseCase(
      new MockRequestRepo() as any, new MockShowRepo() as any, new MockCredsRepo() as any,
      new MockRegistry(buildMockGateway()) as any, mockLogger as any
    );
    await expect(useCase.execute({ musicRequestId: "nope" })).rejects.toThrow("não encontrado");
  });
});
