import { describe, expect, test } from "bun:test";
import { GetArtistMetricsUseCase } from "./get-artist-metrics.use-case";

class MockRequestRepo {
  constructor(private totals: { totalEarnedCents: number; totalRequestsPlayed: number }) {}
  async save() {}
  async findById() {
    return null;
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
    return this.totals;
  }
}

class MockShowRepo {
  async findById() {
    return null;
  }
  async save() {}
  async findActiveByArtistId() {
    return null;
  }
  async findAll() {
    return [];
  }
  async markExpiredShows() {}
}

const mockLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

describe("GetArtistMetrics Use Case (RN02)", () => {
  test("divide 85/15 entre artista e plataforma", async () => {
    const useCase = new GetArtistMetricsUseCase(
      new MockRequestRepo({ totalEarnedCents: 10_000, totalRequestsPlayed: 3 }) as any,
      new MockShowRepo() as any,
      mockLogger as any
    );

    const m = await useCase.execute("artist-1");

    expect(m.totalEarned).toBe(100);
    expect(m.appShare).toBe(15);
    expect(m.artistShare).toBe(85);
    expect(m.totalRequestsPlayed).toBe(3);
  });

  test("retorna zeros quando não há pedidos tocados", async () => {
    const useCase = new GetArtistMetricsUseCase(
      new MockRequestRepo({ totalEarnedCents: 0, totalRequestsPlayed: 0 }) as any,
      new MockShowRepo() as any,
      mockLogger as any
    );

    const m = await useCase.execute("artist-1");
    expect(m.totalEarned).toBe(0);
    expect(m.appShare).toBe(0);
    expect(m.artistShare).toBe(0);
  });
});
