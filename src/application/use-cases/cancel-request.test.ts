import { expect, test, describe } from "bun:test";
import { CancelMusicRequestUseCase } from "./cancel-request.use-case";
import { MusicRequest } from "../../core/entities/music-request.entity";
import { Show } from "../../core/entities/show.entity";
import { Money } from "../../core/value-objects/money.vo";
import { ShowDuration } from "../../core/value-objects/show-duration.vo";
import { UnauthorizedError, NotFoundError } from "../../core/errors/app-error";

class MockRequestRepo {
  private requests: MusicRequest[] = [];
  async save(req: MusicRequest) {
    const idx = this.requests.findIndex(r => r.id === req.id);
    if (idx >= 0) this.requests[idx] = req;
    else this.requests.push(req);
  }
  async findById(id: string) { return this.requests.find(r => r.id === id) || null; }
  async findByShowId() { return []; }
  async countFreeRequestsByCustomer() { return 0; }
  async updateStatusBySong() {}
}

class MockShowRepo {
  private shows: Show[] = [];
  add(s: Show) { this.shows.push(s); }
  async findById(id: string) { return this.shows.find(s => s.id === id) || null; }
  async save() {}
  async findActiveByArtistId() { return null; }
  async findAll() { return []; }
  async markExpiredShows() {}
}

const mockLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };

describe("CancelMusicRequest Use Case (RN05)", () => {
  test("deve cancelar um pedido pendente do próprio artista", async () => {
    const reqRepo = new MockRequestRepo();
    const showRepo = new MockShowRepo();
    showRepo.add(new Show("show-1", "artist-1", new Date(), new ShowDuration(4), 'active'));
    const req = new MusicRequest("req-1", "show-1", "song-1", "André", null, null, new Money(0));
    await reqRepo.save(req);

    const useCase = new CancelMusicRequestUseCase(reqRepo as any, showRepo as any, mockLogger as any);
    await useCase.execute({ requestId: "req-1", artistId: "artist-1" });

    const updated = await reqRepo.findById("req-1");
    expect(updated?.status).toBe('cancelled');
  });

  test("não deve cancelar pedido já tocado", async () => {
    const reqRepo = new MockRequestRepo();
    const showRepo = new MockShowRepo();
    showRepo.add(new Show("show-1", "artist-1", new Date(), new ShowDuration(4), 'active'));
    const req = new MusicRequest("req-1", "show-1", "song-1", "André", null, null, new Money(0), 'played');
    await reqRepo.save(req);

    const useCase = new CancelMusicRequestUseCase(reqRepo as any, showRepo as any, mockLogger as any);
    await expect(
      useCase.execute({ requestId: "req-1", artistId: "artist-1" })
    ).rejects.toThrow("já foi tocado");
  });

  test("deve rejeitar cancelamento por artista que não é dono do show", async () => {
    const reqRepo = new MockRequestRepo();
    const showRepo = new MockShowRepo();
    showRepo.add(new Show("show-1", "artist-1", new Date(), new ShowDuration(4), 'active'));
    const req = new MusicRequest("req-1", "show-1", "song-1", "André", null, null, new Money(0));
    await reqRepo.save(req);

    const useCase = new CancelMusicRequestUseCase(reqRepo as any, showRepo as any, mockLogger as any);
    await expect(
      useCase.execute({ requestId: "req-1", artistId: "artist-2" })
    ).rejects.toThrow(UnauthorizedError);
  });

  test("deve lançar NotFound quando pedido não existe", async () => {
    const reqRepo = new MockRequestRepo();
    const showRepo = new MockShowRepo();
    const useCase = new CancelMusicRequestUseCase(reqRepo as any, showRepo as any, mockLogger as any);
    await expect(
      useCase.execute({ requestId: "nope", artistId: "a" })
    ).rejects.toThrow(NotFoundError);
  });
});
