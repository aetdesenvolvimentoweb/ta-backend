import { describe, expect, test } from "bun:test";
import { MusicRequest } from "../../core/entities/music-request.entity";
import { Show } from "../../core/entities/show.entity";
import { Money } from "../../core/value-objects/money.vo";
import { ShowDuration } from "../../core/value-objects/show-duration.vo";
import { ProcessPaymentNotificationUseCase } from "./process-payment-notification.use-case";

const mockLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

function makeRequestWithPayment(paymentStatus: "pending" | "approved" | "rejected" | "refunded") {
  const req = new MusicRequest("req-1", "show-1", "song-1", "João", "sess-1", null, new Money(500));
  req.attachPayment({ gateway: "mercado_pago", paymentId: "pay-42", status: paymentStatus });
  return req;
}

class MockRequestRepo {
  byPaymentId = new Map<string, MusicRequest>();
  requests = new Map<string, MusicRequest>();
  async findByPaymentId(id: string) {
    return this.byPaymentId.get(id) ?? null;
  }
  async findById(id: string) {
    return this.requests.get(id) ?? null;
  }
  async save(r: MusicRequest) {
    this.requests.set(r.id, r);
    if (r.payment?.paymentId) this.byPaymentId.set(r.payment.paymentId, r);
  }
  async findByShowId() {
    return [];
  }
  async countFreeRequestsByCustomer() {
    return 0;
  }
  async updateStatusBySong() {}
  async aggregateAppMetrics() {
    return { totalVolumeCents: 0, topSongsByRequestCount: [], topArtistsByRevenue: [] };
  }
  async aggregateArtistMetrics() {
    return { totalEarnedCents: 0, totalRequestsPlayed: 0 };
  }
}

class MockShowRepo {
  shows = new Map<string, Show>();
  async findById(id: string) {
    return this.shows.get(id) ?? null;
  }
  async save() {}
  async findActiveByArtistId() {
    return null;
  }
  async findAll() {
    return [];
  }
  async markExpiredShows() {}
}

class MockCredsRepo {
  creds: any = null;
  async findByArtistId() {
    return this.creds;
  }
  async save() {}
  async deleteByArtistId() {}
}

const buildMockGateway = (status: "pending" | "approved" | "rejected" | "refunded") => ({
  name: "mercado_pago",
  buildAuthorizeUrl: () => "",
  exchangeOAuthCode: async () => ({}) as any,
  refreshAccessToken: async () => ({}) as any,
  createTipPayment: async () => ({}) as any,
  refundTipPayment: async () => {},
  fetchPaymentStatus: async () => status,
});

class MockRegistry {
  constructor(private gw: any) {}
  get() {
    return this.gw;
  }
  list() {
    return ["mercado_pago" as const];
  }
}

describe("ProcessPaymentNotificationUseCase", () => {
  test("atualiza status para 'approved' quando gateway retorna approved", async () => {
    const reqRepo = new MockRequestRepo();
    const showRepo = new MockShowRepo();
    const credsRepo = new MockCredsRepo();

    const req = makeRequestWithPayment("pending");
    reqRepo.byPaymentId.set("pay-42", req);
    reqRepo.requests.set(req.id, req);
    showRepo.shows.set(
      "show-1",
      new Show("show-1", "artist-1", new Date(), new ShowDuration(4), "active")
    );

    const useCase = new ProcessPaymentNotificationUseCase(
      reqRepo as any,
      showRepo as any,
      credsRepo as any,
      new MockRegistry(buildMockGateway("approved")) as any,
      mockLogger as any
    );

    await useCase.execute({ paymentId: "pay-42" });

    const saved = await reqRepo.findById("req-1");
    expect(saved?.payment?.status).toBe("approved");
  });

  test("é idempotente — ignora quando status já é o mesmo", async () => {
    const reqRepo = new MockRequestRepo();
    const showRepo = new MockShowRepo();

    const req = makeRequestWithPayment("approved");
    reqRepo.byPaymentId.set("pay-42", req);
    reqRepo.requests.set(req.id, req);
    showRepo.shows.set(
      "show-1",
      new Show("show-1", "artist-1", new Date(), new ShowDuration(4), "active")
    );

    let saveCount = 0;
    const origSave = reqRepo.save.bind(reqRepo);
    reqRepo.save = async (r: MusicRequest) => {
      saveCount++;
      return origSave(r);
    };

    const useCase = new ProcessPaymentNotificationUseCase(
      reqRepo as any,
      showRepo as any,
      new MockCredsRepo() as any,
      new MockRegistry(buildMockGateway("approved")) as any,
      mockLogger as any
    );

    await useCase.execute({ paymentId: "pay-42" });
    expect(saveCount).toBe(0);
  });

  test("ignora paymentId desconhecido sem lançar erro", async () => {
    const reqRepo = new MockRequestRepo();
    const useCase = new ProcessPaymentNotificationUseCase(
      reqRepo as any,
      new MockShowRepo() as any,
      new MockCredsRepo() as any,
      new MockRegistry(buildMockGateway("approved")) as any,
      mockLogger as any
    );

    await expect(useCase.execute({ paymentId: "unknown-pay" })).resolves.toBeUndefined();
  });

  test("marca request como refunded quando status é refunded", async () => {
    const reqRepo = new MockRequestRepo();
    const showRepo = new MockShowRepo();

    const req = makeRequestWithPayment("approved");
    reqRepo.byPaymentId.set("pay-42", req);
    reqRepo.requests.set(req.id, req);
    showRepo.shows.set(
      "show-1",
      new Show("show-1", "artist-1", new Date(), new ShowDuration(4), "active")
    );

    const useCase = new ProcessPaymentNotificationUseCase(
      reqRepo as any,
      showRepo as any,
      new MockCredsRepo() as any,
      new MockRegistry(buildMockGateway("refunded")) as any,
      mockLogger as any
    );

    await useCase.execute({ paymentId: "pay-42" });

    const saved = await reqRepo.findById("req-1");
    expect(saved?.payment?.status).toBe("refunded");
    expect(saved?.status).toBe("refunded");
  });
});
