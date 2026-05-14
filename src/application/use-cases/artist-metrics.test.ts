import { expect, test, describe } from "bun:test";
import { GetArtistMetricsUseCase } from "./get-artist-metrics.use-case";
import { MusicRequest } from "../../core/entities/music-request.entity";
import { Money } from "../../core/value-objects/money.vo";
import { Show } from "../../core/entities/show.entity";
import { ShowDuration } from "../../core/value-objects/show-duration.vo";

class MockRequestRepo {
  async findByShowId(showId: string) {
    return [
      new MusicRequest("1", showId, "s1", "A", null, null, new Money(10000), 'played'), // R$ 100,00
      new MusicRequest("2", showId, "s2", "B", null, null, new Money(5000), 'played'),  // R$ 50,00
      new MusicRequest("3", showId, "s3", "C", null, null, new Money(2000), 'pending'), // R$ 20,00 (não conta)
    ];
  }
  async save() {}
  async countFreeRequestsByCustomer() { return 0; }
  async findById() { return null; }
  async updateStatusBySong() {}
}

class MockShowRepo {
  async findActiveByArtistId(id: string) {
    return new Show("show-1", id, new Date(), new ShowDuration(4), 'active');
  }
  async findById() { return null; }
  async save() {}
  async findAll() { return []; }
  async markExpiredShows() {}
}

const mockLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };

describe("GetArtistMetrics Use Case (RN02)", () => {
  test("deve calcular métricas corretamente com 15% de comissão", async () => {
    const useCase = new GetArtistMetricsUseCase(new MockRequestRepo() as any, new MockShowRepo() as any, mockLogger as any);

    const metrics = await useCase.execute("artist-1");

    // Total: 100 + 50 = 150.00
    // App (15%): 22.50
    // Artista (85%): 127.50
    expect(metrics.totalEarned).toBe(150.00);
    expect(metrics.appShare).toBe(22.50);
    expect(metrics.artistShare).toBe(127.50);
    expect(metrics.totalRequestsPlayed).toBe(2);
  });
});
