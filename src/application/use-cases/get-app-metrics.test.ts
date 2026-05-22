import { describe, expect, test } from "bun:test";
import { GetAppMetricsUseCase } from "./get-app-metrics.use-case";

class MockRequestRepo {
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
    return {
      totalVolumeCents: 100_000,
      topSongsByRequestCount: [{ title: "Evidências", count: 12 }],
      topArtistsByRevenue: [{ name: "Banda X", revenueCents: 60_000 }],
    };
  }
  async aggregateArtistMetrics() {
    return { totalEarnedCents: 0, totalRequestsPlayed: 0 };
  }
}

const mockLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

describe("GetAppMetrics Use Case", () => {
  test("aplica comissão de 15% e converte para reais", async () => {
    const useCase = new GetAppMetricsUseCase(
      new MockRequestRepo() as any,
      {} as any,
      {} as any,
      mockLogger as any
    );

    const metrics = await useCase.execute();

    expect(metrics.totalVolumeTransacted).toBe(1000); // R$ 1.000,00
    expect(metrics.totalAppRevenue).toBe(150); // 15%
    expect(metrics.totalArtistsRevenue).toBe(850); // 85%
    expect(metrics.appCommissionPercent).toBe(0.15);
    expect(metrics.topSongsByRequestCount[0]?.title).toBe("Evidências");
    expect(metrics.topArtistsByRevenue[0]?.revenue).toBe(600);
  });
});
