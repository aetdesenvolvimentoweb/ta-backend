import { describe, expect, test } from "bun:test";
import { Artist } from "../../core/entities/artist.entity";
import { MusicRequest } from "../../core/entities/music-request.entity";
import { Email } from "../../core/value-objects/email.vo";
import { Money } from "../../core/value-objects/money.vo";
import { PaymentAccount } from "../../core/value-objects/payment-account.vo";
import { ProcessPaymentNotificationUseCase } from "./process-payment-notification.use-case";

const mockLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

function makeArtist() {
  const a = new Artist("artist-1", "DJ", new Email("dj@test.com"));
  a.connectPaymentAccount(new PaymentAccount("mercado_pago", "mp-seller-1"));
  return a;
}

function makeRequestWithPreference(preferenceId: string) {
  const req = new MusicRequest("req-1", "show-1", "song-1", "João", "sess-1", null, new Money(500));
  req.attachPayment({ gateway: "mercado_pago", paymentId: preferenceId, status: "pending" });
  return req;
}

class MockRequestRepo {
  requests = new Map<string, MusicRequest>();
  saved: MusicRequest[] = [];
  async findById(id: string) {
    return this.requests.get(id) ?? null;
  }
  async findByPaymentId() {
    return null;
  }
  async save(r: MusicRequest) {
    this.requests.set(r.id, r);
    this.saved.push(r);
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

class MockArtistRepo {
  byPaymentAccount = new Map<string, Artist>();
  async findById() {
    return null;
  }
  async findByEmail() {
    return null;
  }
  async findByPaymentAccount(gateway: string, ext: string) {
    return this.byPaymentAccount.get(`${gateway}:${ext}`) ?? null;
  }
  async save() {}
  async delete() {}
}

class MockCredsRepo {
  creds: any = null;
  async findByArtistId() {
    return this.creds;
  }
  async save() {}
  async deleteByArtistId() {}
}

const buildGateway = (
  status: "pending" | "approved" | "rejected" | "refunded",
  extRef?: string
) => ({
  name: "mercado_pago",
  buildAuthorizeUrl: () => "",
  exchangeOAuthCode: async () => ({}) as any,
  refreshAccessToken: async () => ({}) as any,
  createTipPayment: async () => ({}) as any,
  refundTipPayment: async () => {},
  fetchPaymentStatus: async () => ({ status, externalReference: extRef }),
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

function setup(opts: {
  preferenceIdStored?: string;
  gwStatus: "pending" | "approved" | "rejected" | "refunded";
  gwExternalReference?: string;
}) {
  const reqRepo = new MockRequestRepo();
  const artistRepo = new MockArtistRepo();
  const credsRepo = new MockCredsRepo();

  artistRepo.byPaymentAccount.set("mercado_pago:mp-seller-1", makeArtist());
  credsRepo.creds = { artistId: "artist-1", gateway: "mercado_pago", accessToken: "at-1" };

  if (opts.preferenceIdStored) {
    reqRepo.requests.set("req-1", makeRequestWithPreference(opts.preferenceIdStored));
  }

  const useCase = new ProcessPaymentNotificationUseCase(
    reqRepo as any,
    artistRepo as any,
    credsRepo as any,
    new MockRegistry(buildGateway(opts.gwStatus, opts.gwExternalReference)) as any,
    mockLogger as any
  );
  return { useCase, reqRepo, artistRepo, credsRepo };
}

describe("ProcessPaymentNotificationUseCase — Checkout Pro", () => {
  test("primeira notificação: upgrade preferenceId → paymentId real + status approved", async () => {
    const { useCase, reqRepo } = setup({
      preferenceIdStored: "pref-1",
      gwStatus: "approved",
      gwExternalReference: "req-1",
    });

    await useCase.execute({
      paymentId: "pay-real-99",
      sellerExternalAccountId: "mp-seller-1",
      gateway: "mercado_pago",
    });

    const saved = await reqRepo.findById("req-1");
    expect(saved?.payment?.paymentId).toBe("pay-real-99");
    expect(saved?.payment?.status).toBe("approved");
  });

  test("idempotente: ignora quando paymentId e status já estão consolidados", async () => {
    const { useCase, reqRepo } = setup({
      preferenceIdStored: "pay-real-99",
      gwStatus: "approved",
      gwExternalReference: "req-1",
    });
    const req = await reqRepo.findById("req-1");
    req!.markPaymentStatus("approved");
    reqRepo.saved = [];

    await useCase.execute({
      paymentId: "pay-real-99",
      sellerExternalAccountId: "mp-seller-1",
      gateway: "mercado_pago",
    });

    expect(reqRepo.saved.length).toBe(0);
  });

  test("ignora quando artista não é da nossa base (extAcc desconhecida)", async () => {
    const { useCase, reqRepo } = setup({
      gwStatus: "approved",
      gwExternalReference: "req-1",
    });
    await expect(
      useCase.execute({
        paymentId: "pay-x",
        sellerExternalAccountId: "outro-seller",
        gateway: "mercado_pago",
      })
    ).resolves.toBeUndefined();
    expect(reqRepo.saved.length).toBe(0);
  });

  test("ignora pagamento sem external_reference (não criado por nós)", async () => {
    const { useCase, reqRepo } = setup({
      preferenceIdStored: "pref-1",
      gwStatus: "approved",
      gwExternalReference: undefined,
    });
    await useCase.execute({
      paymentId: "pay-foreign",
      sellerExternalAccountId: "mp-seller-1",
      gateway: "mercado_pago",
    });
    expect(reqRepo.saved.length).toBe(0);
  });

  test("status refunded propaga para request.status", async () => {
    const { useCase, reqRepo } = setup({
      preferenceIdStored: "pref-1",
      gwStatus: "refunded",
      gwExternalReference: "req-1",
    });
    await useCase.execute({
      paymentId: "pay-real-99",
      sellerExternalAccountId: "mp-seller-1",
      gateway: "mercado_pago",
    });
    const saved = await reqRepo.findById("req-1");
    expect(saved?.payment?.status).toBe("refunded");
    expect(saved?.status).toBe("refunded");
  });
});
