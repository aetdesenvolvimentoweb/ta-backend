import { expect, test, describe } from "bun:test";
import { CancelMusicRequestUseCase } from "./cancel-request.use-case";
import { MusicRequest } from "../../core/entities/music-request.entity";
import { Money } from "../../core/value-objects/money.vo";

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

describe("CancelMusicRequest Use Case (RN05)", () => {
  test("deve cancelar um pedido pendente", async () => {
    const repo = new MockRequestRepo();
    const req = new MusicRequest("req-1", "show-1", "song-1", "André", null, new Money(0));
    await repo.save(req);

    const useCase = new CancelMusicRequestUseCase(repo);
    await useCase.execute("req-1");

    const updated = await repo.findById("req-1");
    expect(updated?.status).toBe('cancelled');
  });

  test("não deve cancelar pedido já tocado", async () => {
    const repo = new MockRequestRepo();
    const req = new MusicRequest("req-1", "show-1", "song-1", "André", null, new Money(0), 'played');
    await repo.save(req);

    const useCase = new CancelMusicRequestUseCase(repo);
    expect(useCase.execute("req-1")).rejects.toThrow("já foi tocado");
  });
});
