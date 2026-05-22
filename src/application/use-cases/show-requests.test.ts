import { describe, expect, test } from "bun:test";
import { MusicRequest } from "../../core/entities/music-request.entity";
import { Show } from "../../core/entities/show.entity";
import { NotFoundError, UnauthorizedError } from "../../core/errors/app-error";
import { Money } from "../../core/value-objects/money.vo";
import { ShowDuration } from "../../core/value-objects/show-duration.vo";
import { GetShowRequestsUseCase } from "./get-show-requests.use-case";

class MockRequestRepo {
  private requests: MusicRequest[] = [];

  constructor(initialRequests: MusicRequest[] = []) {
    this.requests = initialRequests;
  }

  async findByShowId(showId: string) {
    return this.requests.filter((r) => r.showId === showId);
  }
  async save() {}
  async countFreeRequestsByCustomer() {
    return 0;
  }
  async findById() {
    return null;
  }
  async updateStatusBySong() {}
}

class MockShowRepo {
  private shows: Show[] = [];
  add(s: Show) {
    this.shows.push(s);
  }
  async findById(id: string) {
    return this.shows.find((s) => s.id === id) || null;
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

const mockLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };

describe("GetShowRequests Use Case (RN02)", () => {
  test("deve ordenar pedidos por gorjeta (maior primeiro) e depois por chegada", async () => {
    const now = Date.now();

    const req1 = new MusicRequest(
      "1",
      "show-1",
      "s1",
      "A",
      null,
      null,
      new Money(1000),
      "pending",
      new Date(now)
    );
    const req2 = new MusicRequest(
      "2",
      "show-1",
      "s2",
      "B",
      null,
      null,
      new Money(2000),
      "pending",
      new Date(now + 1000)
    );
    const req3 = new MusicRequest(
      "3",
      "show-1",
      "s3",
      "C",
      null,
      null,
      new Money(1000),
      "pending",
      new Date(now - 1000)
    );

    const reqRepo = new MockRequestRepo([req1, req2, req3]);
    const showRepo = new MockShowRepo();
    showRepo.add(new Show("show-1", "artist-1", new Date(), new ShowDuration(4), "active"));

    const useCase = new GetShowRequestsUseCase(reqRepo as any, showRepo as any, mockLogger as any);
    const sorted = await useCase.execute({ showId: "show-1", artistId: "artist-1" });

    expect(sorted[0]!.id).toBe("2");
    expect(sorted[1]!.id).toBe("3");
    expect(sorted[2]!.id).toBe("1");
  });

  test("deve rejeitar leitura de pedidos de show de outro artista", async () => {
    const reqRepo = new MockRequestRepo([]);
    const showRepo = new MockShowRepo();
    showRepo.add(new Show("show-1", "artist-1", new Date(), new ShowDuration(4), "active"));

    const useCase = new GetShowRequestsUseCase(reqRepo as any, showRepo as any, mockLogger as any);
    await expect(useCase.execute({ showId: "show-1", artistId: "artist-2" })).rejects.toThrow(
      UnauthorizedError
    );
  });

  test("deve lançar NotFound quando show não existe", async () => {
    const reqRepo = new MockRequestRepo([]);
    const showRepo = new MockShowRepo();
    const useCase = new GetShowRequestsUseCase(reqRepo as any, showRepo as any, mockLogger as any);
    await expect(useCase.execute({ showId: "nope", artistId: "a" })).rejects.toThrow(NotFoundError);
  });
});
