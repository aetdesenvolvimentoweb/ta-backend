import { expect, test, describe } from "bun:test";
import { RequestMusicUseCase } from "./request-music.use-case";
import { MusicRequest } from "../../core/entities/music-request.entity";
import { Show } from "../../core/entities/show.entity";
import { Song } from "../../core/entities/song.entity";
import { Artist } from "../../core/entities/artist.entity";
import { Email } from "../../core/value-objects/email.vo";
import { PaymentAccount } from "../../core/value-objects/payment-account.vo";
import { ShowDuration } from "../../core/value-objects/show-duration.vo";
import { BasicProfanityFilter } from "../../infra/security/basic-profanity-filter";

class MockRequestRepo {
  private requests: MusicRequest[] = [];
  async save(req: MusicRequest) { this.requests.push(req); }
  async countFreeRequestsByCustomer(showId: string, _sid: string) {
    return this.requests.filter(r => r.showId === showId && r.tip.amountInCents === 0).length;
  }
  async findByShowId() { return []; }
  async findById() { return null; }
  async updateStatusBySong() {}
}

class MockShowRepo {
  async findById(id: string) {
    return new Show(id, "artist-1", new Date(), new ShowDuration(4), 'active');
  }
  async save() {}
  async findActiveByArtistId() { return null; }
  async findAll() { return []; }
  async markExpiredShows() {}
}

class MockSongRepo {
  async findById(id: string) {
    return new Song(id, "artist-1", "Música 1", "Original", "style-1", true);
  }
  async save() {}
  async findByArtistId() { return []; }
  async delete() {}
}

class MockArtistRepo {
  constructor(private withPayment: boolean = true) {}
  async findById(id: string) {
    const artist = new Artist(id, "Artista", new Email("a@a.com"));
    if (this.withPayment) {
      artist.connectPaymentAccount(new PaymentAccount('mercado_pago', 'mp-collector-123'));
    }
    return artist;
  }
  async findByEmail() { return null; }
  async save() {}
  async delete() {}
}

const mockLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
const profanityFilter = new BasicProfanityFilter();

const buildUseCase = (reqRepo?: MockRequestRepo, artistConnected: boolean = true) =>
  new RequestMusicUseCase(
    (reqRepo ?? new MockRequestRepo()) as any,
    new MockShowRepo() as any,
    new MockSongRepo() as any,
    new MockArtistRepo(artistConnected) as any,
    mockLogger as any,
    profanityFilter
  );

describe("RequestMusic Use Case", () => {
  test("deve permitir o primeiro pedido gratuito (RN09)", async () => {
    const useCase = buildUseCase();
    const req = await useCase.execute({
      showId: "show-1",
      songId: "song-1",
      customerName: "André",
      customerSessionId: "session-123",
      tipAmountInCents: 0
    });
    expect(req.tip.amountInCents).toBe(0);
  });

  test("deve impedir o segundo pedido gratuito (RN09)", async () => {
    const requestRepo = new MockRequestRepo();
    const useCase = buildUseCase(requestRepo);

    await useCase.execute({
      showId: "show-1",
      songId: "song-1",
      customerName: "André",
      customerSessionId: "session-123",
      tipAmountInCents: 0
    });

    await expect(useCase.execute({
      showId: "show-1",
      songId: "song-2",
      customerName: "André",
      customerSessionId: "session-123",
      tipAmountInCents: 0
    })).rejects.toThrow("já utilizou seu pedido gratuito");
  });

  test("deve permitir o segundo pedido se houver gorjeta", async () => {
    const requestRepo = new MockRequestRepo();
    const useCase = buildUseCase(requestRepo);

    await useCase.execute({
      showId: "show-1",
      songId: "song-1",
      customerName: "André",
      customerSessionId: "session-123",
      tipAmountInCents: 0
    });

    const secondReq = await useCase.execute({
      showId: "show-1",
      songId: "song-2",
      customerName: "André",
      customerSessionId: "session-123",
      tipAmountInCents: 1000
    });

    expect(secondReq.tip.amountInCents).toBe(1000);
  });

  test("deve recusar tip quando artista não tem conta de pagamento conectada (RN15)", async () => {
    const useCase = buildUseCase(undefined, false);

    await expect(useCase.execute({
      showId: "show-1",
      songId: "song-1",
      customerName: "André",
      customerSessionId: "session-rn15",
      tipAmountInCents: 1000
    })).rejects.toThrow("não habilitou gorjetas");
  });

  test("deve permitir pedido gratuito mesmo sem conta de pagamento (RN15 não bloqueia RN09)", async () => {
    const useCase = buildUseCase(undefined, false);
    const req = await useCase.execute({
      showId: "show-1",
      songId: "song-1",
      customerName: "André",
      customerSessionId: "session-rn15-free",
      tipAmountInCents: 0
    });
    expect(req.tip.amountInCents).toBe(0);
  });

  test("deve censurar palavras ofensivas na mensagem (RN08)", async () => {
    const useCase = buildUseCase();
    const req = await useCase.execute({
      showId: "show-1",
      songId: "song-1",
      customerName: "André",
      customerSessionId: "session-rn08",
      message: "toca essa merda aí",
      tipAmountInCents: 500
    });
    expect(req.message).not.toContain("merda");
    expect(req.message).toContain("*");
  });
});
