import { beforeEach, describe, expect, test } from "bun:test";
import { Artist } from "../../core/entities/artist.entity";
import type { IArtistRepository } from "../../core/ports/artist.repository";
import type { IEmailService, SendEmailInput } from "../../core/ports/email-service.port";
import type { IPasswordHasher } from "../../core/ports/password-hasher.port";
import type {
  IPasswordResetTokenRepository,
  PasswordResetTokenRecord,
} from "../../core/ports/password-reset-token.repository";
import { Email } from "../../core/value-objects/email.vo";
import { RequestPasswordResetUseCase } from "./request-password-reset.use-case";
import { ResetPasswordUseCase } from "./reset-password.use-case";

class FakeArtistRepo implements IArtistRepository {
  artists = new Map<string, Artist>();
  byEmail(email: string): Artist | null {
    for (const a of this.artists.values()) {
      if (a.email.getValue() === email) return a;
    }
    return null;
  }
  async findByEmail(email: string) {
    return this.byEmail(email);
  }
  async findById(id: string) {
    return this.artists.get(id) ?? null;
  }
  async save(artist: Artist) {
    this.artists.set(artist.id, artist);
  }
  async findByPaymentAccount() {
    return null;
  }
  async delete(id: string) {
    this.artists.delete(id);
  }
}

class FakeTokenRepo implements IPasswordResetTokenRepository {
  records = new Map<string, PasswordResetTokenRecord>();
  async save(record: PasswordResetTokenRecord) {
    this.records.set(record.id, { ...record });
  }
  async findByHash(tokenHash: string) {
    for (const r of this.records.values()) {
      if (r.tokenHash === tokenHash) return { ...r };
    }
    return null;
  }
  async invalidateAllForArtist(artistId: string) {
    for (const r of this.records.values()) {
      if (r.artistId === artistId && r.usedAt === null) {
        r.usedAt = new Date();
      }
    }
  }
}

class FakeHasher implements IPasswordHasher {
  async hash(p: string) {
    return `hash:${p}`;
  }
  async compare(p: string, h: string) {
    return h === `hash:${p}`;
  }
}

class FakeEmailService implements IEmailService {
  sent: SendEmailInput[] = [];
  async send(input: SendEmailInput) {
    this.sent.push(input);
  }
}

const noopLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} } as const;

const FRONTEND = "http://localhost:5173";
const TTL_MIN = 30;

function makeArtist(id: string, email: string, passwordHash = "hash:antiga"): Artist {
  return new Artist(id, "Test Artist", new Email(email), passwordHash);
}

describe("RequestPasswordResetUseCase", () => {
  let artistRepo: FakeArtistRepo;
  let tokenRepo: FakeTokenRepo;
  let email: FakeEmailService;

  beforeEach(() => {
    artistRepo = new FakeArtistRepo();
    tokenRepo = new FakeTokenRepo();
    email = new FakeEmailService();
  });

  test("envia e-mail e cria token quando o artista existe", async () => {
    const artist = makeArtist("a-1", "user@example.com");
    artistRepo.artists.set(artist.id, artist);

    const useCase = new RequestPasswordResetUseCase({
      artistRepository: artistRepo,
      tokenRepository: tokenRepo,
      emailService: email,
      logger: noopLogger as any,
      frontendBaseUrl: FRONTEND,
      tokenTtlMin: TTL_MIN,
    });

    await useCase.execute({ email: "user@example.com" });

    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]?.to).toBe("user@example.com");
    expect(email.sent[0]?.text).toContain("/artista/redefinir-senha?token=");
    expect(tokenRepo.records.size).toBe(1);
    const [record] = Array.from(tokenRepo.records.values());
    expect(record?.artistId).toBe("a-1");
    expect(record?.usedAt).toBeNull();
    expect(record?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test("não envia e-mail mas retorna sucesso quando o e-mail não existe (anti-enumeração)", async () => {
    const useCase = new RequestPasswordResetUseCase({
      artistRepository: artistRepo,
      tokenRepository: tokenRepo,
      emailService: email,
      logger: noopLogger as any,
      frontendBaseUrl: FRONTEND,
      tokenTtlMin: TTL_MIN,
    });

    await useCase.execute({ email: "ninguem@example.com" });

    expect(email.sent).toHaveLength(0);
    expect(tokenRepo.records.size).toBe(0);
  });

  test("invalida tokens anteriores ao gerar um novo", async () => {
    const artist = makeArtist("a-1", "user@example.com");
    artistRepo.artists.set(artist.id, artist);

    const useCase = new RequestPasswordResetUseCase({
      artistRepository: artistRepo,
      tokenRepository: tokenRepo,
      emailService: email,
      logger: noopLogger as any,
      frontendBaseUrl: FRONTEND,
      tokenTtlMin: TTL_MIN,
    });

    await useCase.execute({ email: "user@example.com" });
    await useCase.execute({ email: "user@example.com" });

    const records = Array.from(tokenRepo.records.values());
    expect(records).toHaveLength(2);
    const active = records.filter((r) => r.usedAt === null);
    expect(active).toHaveLength(1);
  });

  test("retorna silenciosamente se o e-mail for malformado", async () => {
    const useCase = new RequestPasswordResetUseCase({
      artistRepository: artistRepo,
      tokenRepository: tokenRepo,
      emailService: email,
      logger: noopLogger as any,
      frontendBaseUrl: FRONTEND,
      tokenTtlMin: TTL_MIN,
    });

    await useCase.execute({ email: "nao-eh-email" });

    expect(email.sent).toHaveLength(0);
    expect(tokenRepo.records.size).toBe(0);
  });

  test("loga link quando emailService é null (modo dev)", async () => {
    const artist = makeArtist("a-1", "user@example.com");
    artistRepo.artists.set(artist.id, artist);

    let loggedContext: any = null;
    const logger = {
      info: (_msg: string, ctx?: any) => {
        if (ctx?.event === "password_reset.email_disabled") loggedContext = ctx;
      },
      error: () => {},
      warn: () => {},
      debug: () => {},
    };

    const useCase = new RequestPasswordResetUseCase({
      artistRepository: artistRepo,
      tokenRepository: tokenRepo,
      emailService: null,
      logger: logger as any,
      frontendBaseUrl: FRONTEND,
      tokenTtlMin: TTL_MIN,
    });

    await useCase.execute({ email: "user@example.com" });

    expect(loggedContext).not.toBeNull();
    expect(String(loggedContext?.link)).toContain("/artista/redefinir-senha?token=");
  });
});

describe("ResetPasswordUseCase", () => {
  let artistRepo: FakeArtistRepo;
  let tokenRepo: FakeTokenRepo;
  let email: FakeEmailService;
  let hasher: FakeHasher;

  beforeEach(() => {
    artistRepo = new FakeArtistRepo();
    tokenRepo = new FakeTokenRepo();
    email = new FakeEmailService();
    hasher = new FakeHasher();
  });

  async function setupValidToken(): Promise<{ rawToken: string; artistId: string }> {
    const artist = makeArtist("a-1", "user@example.com");
    artistRepo.artists.set(artist.id, artist);

    const requestUC = new RequestPasswordResetUseCase({
      artistRepository: artistRepo,
      tokenRepository: tokenRepo,
      emailService: email,
      logger: noopLogger as any,
      frontendBaseUrl: FRONTEND,
      tokenTtlMin: TTL_MIN,
    });
    await requestUC.execute({ email: "user@example.com" });

    const sent = email.sent[0];
    if (!sent) throw new Error("email não enviado no setup");
    const match = sent.text.match(/token=([a-f0-9]+)/);
    if (!match?.[1]) throw new Error("token não encontrado no e-mail");
    return { rawToken: match[1], artistId: artist.id };
  }

  test("redefine a senha quando o token é válido", async () => {
    const { rawToken, artistId } = await setupValidToken();

    const useCase = new ResetPasswordUseCase({
      artistRepository: artistRepo,
      tokenRepository: tokenRepo,
      passwordHasher: hasher,
      logger: noopLogger as any,
    });

    await useCase.execute({ token: rawToken, newPassword: "nova-senha-123" });

    const updated = await artistRepo.findById(artistId);
    expect(updated?.passwordHash).toBe("hash:nova-senha-123");
  });

  test("rejeita token inválido", async () => {
    const useCase = new ResetPasswordUseCase({
      artistRepository: artistRepo,
      tokenRepository: tokenRepo,
      passwordHasher: hasher,
      logger: noopLogger as any,
    });

    await expect(
      useCase.execute({ token: "token-fake", newPassword: "nova-senha-123" })
    ).rejects.toThrow("Token inválido ou expirado");
  });

  test("rejeita token já utilizado", async () => {
    const { rawToken } = await setupValidToken();

    const useCase = new ResetPasswordUseCase({
      artistRepository: artistRepo,
      tokenRepository: tokenRepo,
      passwordHasher: hasher,
      logger: noopLogger as any,
    });

    await useCase.execute({ token: rawToken, newPassword: "nova-senha-123" });

    await expect(
      useCase.execute({ token: rawToken, newPassword: "outra-senha-123" })
    ).rejects.toThrow("Token inválido ou expirado");
  });

  test("rejeita token expirado", async () => {
    const artist = makeArtist("a-1", "user@example.com");
    artistRepo.artists.set(artist.id, artist);

    // Insere um token expirado manualmente
    const rawToken = "expirado".padEnd(64, "0");
    const data = new TextEncoder().encode(rawToken);
    const buf = await crypto.subtle.digest("SHA-256", data);
    const tokenHash = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join(
      ""
    );
    await tokenRepo.save({
      id: "t-1",
      artistId: artist.id,
      tokenHash,
      expiresAt: new Date(Date.now() - 60_000),
      usedAt: null,
    });

    const useCase = new ResetPasswordUseCase({
      artistRepository: artistRepo,
      tokenRepository: tokenRepo,
      passwordHasher: hasher,
      logger: noopLogger as any,
    });

    await expect(
      useCase.execute({ token: rawToken, newPassword: "nova-senha-123" })
    ).rejects.toThrow("Token inválido ou expirado");
  });

  test("rejeita senha curta", async () => {
    const { rawToken } = await setupValidToken();

    const useCase = new ResetPasswordUseCase({
      artistRepository: artistRepo,
      tokenRepository: tokenRepo,
      passwordHasher: hasher,
      logger: noopLogger as any,
    });

    await expect(useCase.execute({ token: rawToken, newPassword: "curta" })).rejects.toThrow(
      "12 caracteres"
    );
  });
});
