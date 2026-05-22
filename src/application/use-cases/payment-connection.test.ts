import { describe, expect, test } from "bun:test";
import { Artist } from "../../core/entities/artist.entity";
import { Email } from "../../core/value-objects/email.vo";
import { PaymentAccount } from "../../core/value-objects/payment-account.vo";
import { InMemoryOAuthStateStore } from "../../infra/security/oauth-state-store";
import {
  CompletePaymentConnectionUseCase,
  DisconnectPaymentAccountUseCase,
  StartPaymentConnectionUseCase,
} from "./payment-connection.use-case";

const mockLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

class MockArtistRepo {
  artists = new Map<string, Artist>();
  async findById(id: string) {
    return this.artists.get(id) ?? null;
  }
  async findByEmail() {
    return null;
  }
  async save(a: Artist) {
    this.artists.set(a.id, a);
  }
  async delete(id: string) {
    this.artists.delete(id);
  }
}

class MockCredsRepo {
  saved: any = null;
  deleted: string | null = null;
  async save(c: any) {
    this.saved = c;
  }
  async findByArtistId() {
    return null;
  }
  async deleteByArtistId(id: string) {
    this.deleted = id;
  }
}

const buildMockGateway = (overrides?: Partial<any>) => ({
  name: "mercado_pago",
  buildAuthorizeUrl: (i: any) =>
    `https://auth.test/authz?state=${i.state}&cc=${i.codeChallenge ?? ""}`,
  exchangeOAuthCode: async (_i: any) => ({
    externalAccountId: "mp-collector-42",
    accessToken: "at-1",
    refreshToken: "rt-1",
    expiresAt: new Date(Date.now() + 3600_000),
  }),
  refreshAccessToken: async () => ({}) as any,
  createTipPayment: async () => ({}) as any,
  refundTipPayment: async () => {},
  fetchPaymentStatus: async () => "pending" as const,
  ...overrides,
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

describe("StartPaymentConnectionUseCase", () => {
  test("gera authorizeUrl com state + code_challenge e armazena verifier", async () => {
    const repo = new MockArtistRepo();
    const artist = new Artist("a-1", "Artista", new Email("a@a.com"));
    await repo.save(artist);

    const store = new InMemoryOAuthStateStore();
    const gw = buildMockGateway();
    const useCase = new StartPaymentConnectionUseCase(
      repo as any,
      new MockRegistry(gw) as any,
      store,
      mockLogger as any
    );

    const out = await useCase.execute({
      artistId: "a-1",
      gateway: "mercado_pago",
      redirectUri: "http://cb",
    });

    expect(out.authorizeUrl).toContain(`state=${out.state}`);
    expect(out.authorizeUrl).toContain("cc=");

    // Ao consumir, devolve o verifier armazenado para o artista correto.
    const entry = store.consume(out.state);
    expect(entry.artistId).toBe("a-1");
    expect(entry.gateway).toBe("mercado_pago");
    expect(entry.codeVerifier.length).toBeGreaterThan(20);
  });

  test("falha quando o artista não existe", async () => {
    const repo = new MockArtistRepo();
    const useCase = new StartPaymentConnectionUseCase(
      repo as any,
      new MockRegistry(buildMockGateway()) as any,
      new InMemoryOAuthStateStore(),
      mockLogger as any
    );
    await expect(
      useCase.execute({
        artistId: "missing",
        gateway: "mercado_pago",
        redirectUri: "http://cb",
      })
    ).rejects.toThrow("não encontrado");
  });
});

describe("CompletePaymentConnectionUseCase", () => {
  test("troca code por tokens, salva credentials e conecta paymentAccount no artista", async () => {
    const repo = new MockArtistRepo();
    const artist = new Artist("a-1", "Artista", new Email("a@a.com"));
    await repo.save(artist);

    const creds = new MockCredsRepo();
    const store = new InMemoryOAuthStateStore();
    const gw = buildMockGateway();
    const registry = new MockRegistry(gw);

    store.put("st-1", { artistId: "a-1", gateway: "mercado_pago", codeVerifier: "v-1" });

    const useCase = new CompletePaymentConnectionUseCase(
      repo as any,
      creds as any,
      registry as any,
      store,
      mockLogger as any
    );

    const out = await useCase.execute({
      code: "auth-code",
      state: "st-1",
      redirectUri: "http://cb",
    });

    expect(out.artistId).toBe("a-1");
    expect(out.gateway).toBe("mercado_pago");
    expect(out.externalAccountId).toBe("mp-collector-42");

    const saved = (await repo.findById("a-1"))!;
    expect(saved.canReceiveTips()).toBe(true);
    expect(saved.paymentAccount?.externalAccountId).toBe("mp-collector-42");

    expect(creds.saved.accessToken).toBe("at-1");
    expect(creds.saved.refreshToken).toBe("rt-1");
  });

  test("rejeita state inválido (CSRF/replay)", async () => {
    const repo = new MockArtistRepo();
    const useCase = new CompletePaymentConnectionUseCase(
      repo as any,
      new MockCredsRepo() as any,
      new MockRegistry(buildMockGateway()) as any,
      new InMemoryOAuthStateStore(),
      mockLogger as any
    );
    await expect(useCase.execute({ code: "c", state: "forged", redirectUri: "x" })).rejects.toThrow(
      "inválido"
    );
  });
});

describe("DisconnectPaymentAccountUseCase", () => {
  test("limpa paymentAccount do artista e remove credenciais (idempotente)", async () => {
    const repo = new MockArtistRepo();
    const artist = new Artist("a-1", "Artista", new Email("a@a.com"));
    artist.connectPaymentAccount(new PaymentAccount("mercado_pago", "mp-1"));
    await repo.save(artist);

    const creds = new MockCredsRepo();
    const useCase = new DisconnectPaymentAccountUseCase(
      repo as any,
      creds as any,
      mockLogger as any
    );

    await useCase.execute({ artistId: "a-1" });

    const after = (await repo.findById("a-1"))!;
    expect(after.canReceiveTips()).toBe(false);
    expect(creds.deleted).toBe("a-1");
  });

  test("falha quando o artista não existe", async () => {
    const useCase = new DisconnectPaymentAccountUseCase(
      new MockArtistRepo() as any,
      new MockCredsRepo() as any,
      mockLogger as any
    );
    await expect(useCase.execute({ artistId: "nope" })).rejects.toThrow("não encontrado");
  });
});
