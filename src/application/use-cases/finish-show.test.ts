import { expect, test, describe } from "bun:test";
import { FinishShowUseCase } from "./finish-show.use-case";
import { Show } from "../../core/entities/show.entity";
import { MusicRequest } from "../../core/entities/music-request.entity";
import { Money } from "../../core/value-objects/money.vo";
import { ShowDuration } from "../../core/value-objects/show-duration.vo";

class MockShowRepo {
  private shows: Show[] = [];
  async save(s: Show) { this.shows.push(s); }
  async findById(id: string) { 
    return this.shows.find(s => s.id === id) || null; 
  }
  async findActiveByArtistId() { return null; }
  async findAll() { return []; }
  async markExpiredShows() {}
}

class MockRequestRepo {
  private requests: MusicRequest[] = [];
  async save(r: MusicRequest) { this.requests.push(r); }
  async findByShowId(id: string) { return this.requests.filter(r => r.showId === id); }
  async countFreeRequestsByCustomer() { return 0; }
  async findById() { return null; }
  async updateStatusBySong() {}
}

describe("FinishShow Use Case", () => {
  test("deve encerrar o show e cancelar pedidos pendentes", async () => {
    const showRepo = new MockShowRepo();
    const reqRepo = new MockRequestRepo();
    
    const show = new Show("show-1", "artist-1", new Date(), new ShowDuration(4), 'active');
    await showRepo.save(show);
    
    const req = new MusicRequest("req-1", "show-1", "song-1", "A", null, new Money(0));
    await reqRepo.save(req);

    const useCase = new FinishShowUseCase(showRepo as any, reqRepo as any);
    await useCase.execute("show-1");

    expect(show.status).toBe('finished');
    expect(req.status).toBe('cancelled');
  });
});
