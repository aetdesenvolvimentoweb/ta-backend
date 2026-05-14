import { expect, test, describe } from "bun:test";
import { RequestMusicUseCase } from "./request-music.use-case";
import { MusicRequest } from "../../core/entities/music-request.entity";
import { Show } from "../../core/entities/show.entity";
import { Song } from "../../core/entities/song.entity";
import { ShowDuration } from "../../core/value-objects/show-duration.vo";
import { Money } from "../../core/value-objects/money.vo";

class MockRequestRepo {
  private requests: MusicRequest[] = [];
  async save(req: MusicRequest) { this.requests.push(req); }
  async countFreeRequestsByCustomer(showId: string, sid: string) {
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

const mockLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };

describe("RequestMusic Use Case", () => {
  test("deve permitir o primeiro pedido gratuito (RN09)", async () => {
    const useCase = new RequestMusicUseCase(
      new MockRequestRepo() as any, 
      new MockShowRepo() as any, 
      new MockSongRepo() as any,
      mockLogger as any
    );

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
    const useCase = new RequestMusicUseCase(requestRepo, new MockShowRepo(), new MockSongRepo(), mockLogger as any);

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
    const useCase = new RequestMusicUseCase(requestRepo, new MockShowRepo(), new MockSongRepo(), mockLogger as any);

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
      tipAmountInCents: 1000 // R$ 10,00
    });

    expect(secondReq.tip.amountInCents).toBe(1000);
  });
});
