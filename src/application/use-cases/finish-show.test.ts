import { expect, test, describe } from "bun:test";
import { FinishShowUseCase } from "./finish-show.use-case";
import { Show } from "../../core/entities/show.entity";
import { MusicRequest } from "../../core/entities/music-request.entity";
import { Money } from "../../core/value-objects/money.vo";
import { ShowDuration } from "../../core/value-objects/show-duration.vo";
import { UnauthorizedError, NotFoundError, BusinessRuleError } from "../../core/errors/app-error";

class MockShowRepo {
  private shows: Show[] = [];
  async save(s: Show) {
    const idx = this.shows.findIndex(x => x.id === s.id);
    if (idx >= 0) this.shows[idx] = s; else this.shows.push(s);
  }
  async findById(id: string) {
    return this.shows.find(s => s.id === id) || null;
  }
  async findActiveByArtistId() { return null; }
  async findAll() { return []; }
  async markExpiredShows() {}
}

class MockRequestRepo {
  private requests: MusicRequest[] = [];
  async save(r: MusicRequest) {
    const idx = this.requests.findIndex(x => x.id === r.id);
    if (idx >= 0) this.requests[idx] = r; else this.requests.push(r);
  }
  async findByShowId(id: string) { return this.requests.filter(r => r.showId === id); }
  async countFreeRequestsByCustomer() { return 0; }
  async findById() { return null; }
  async updateStatusBySong() {}
}

const mockLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };

describe("FinishShow Use Case", () => {
  test("deve encerrar o show e cancelar pedidos pendentes", async () => {
    const showRepo = new MockShowRepo();
    const reqRepo = new MockRequestRepo();

    const show = new Show("show-1", "artist-1", new Date(), new ShowDuration(4), 'active');
    await showRepo.save(show);

    const req = new MusicRequest("req-1", "show-1", "song-1", "A", null, null, new Money(0));
    await reqRepo.save(req);

    const useCase = new FinishShowUseCase(showRepo as any, reqRepo as any, mockLogger as any);
    await useCase.execute({ showId: "show-1", artistId: "artist-1" });

    expect(show.status).toBe('finished');
    expect(req.status).toBe('cancelled');
  });

  test("deve rejeitar finalização de show de outro artista", async () => {
    const showRepo = new MockShowRepo();
    const reqRepo = new MockRequestRepo();
    const show = new Show("show-1", "artist-1", new Date(), new ShowDuration(4), 'active');
    await showRepo.save(show);

    const useCase = new FinishShowUseCase(showRepo as any, reqRepo as any, mockLogger as any);
    await expect(
      useCase.execute({ showId: "show-1", artistId: "artist-2" })
    ).rejects.toThrow(UnauthorizedError);
  });

  test("deve lançar NotFound quando show não existe", async () => {
    const showRepo = new MockShowRepo();
    const reqRepo = new MockRequestRepo();
    const useCase = new FinishShowUseCase(showRepo as any, reqRepo as any, mockLogger as any);

    await expect(
      useCase.execute({ showId: "nope", artistId: "a" })
    ).rejects.toThrow(NotFoundError);
  });

  test("deve rejeitar quando show já não está ativo", async () => {
    const showRepo = new MockShowRepo();
    const reqRepo = new MockRequestRepo();
    const show = new Show("show-1", "artist-1", new Date(), new ShowDuration(4), 'finished');
    await showRepo.save(show);

    const useCase = new FinishShowUseCase(showRepo as any, reqRepo as any, mockLogger as any);
    await expect(
      useCase.execute({ showId: "show-1", artistId: "artist-1" })
    ).rejects.toThrow(BusinessRuleError);
  });
});
