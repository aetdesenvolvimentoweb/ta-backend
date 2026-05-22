import { describe, expect, test } from "bun:test";
import { Show } from "../../core/entities/show.entity";
import { NotFoundError, UnauthorizedError } from "../../core/errors/app-error";
import { ShowDuration } from "../../core/value-objects/show-duration.vo";
import { MarkSongAsPlayedUseCase } from "./mark-song-as-played.use-case";

class MockRequestRepo {
  public lastUpdate: { showId: string; songId: string; status: string } | null = null;
  async save() {}
  async findByShowId() {
    return [];
  }
  async findById() {
    return null;
  }
  async countFreeRequestsByCustomer() {
    return 0;
  }
  async updateStatusBySong(showId: string, songId: string, status: any) {
    this.lastUpdate = { showId, songId, status };
  }
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

describe("MarkSongAsPlayed Use Case (RN03)", () => {
  test("deve marcar todos os pedidos pendentes da música como tocados", async () => {
    const reqRepo = new MockRequestRepo();
    const showRepo = new MockShowRepo();
    showRepo.add(new Show("show-1", "artist-1", new Date(), new ShowDuration(4), "active"));

    const useCase = new MarkSongAsPlayedUseCase(reqRepo as any, showRepo as any, mockLogger as any);
    await useCase.execute({ showId: "show-1", songId: "song-1", artistId: "artist-1" });

    expect(reqRepo.lastUpdate).toEqual({ showId: "show-1", songId: "song-1", status: "played" });
  });

  test("deve rejeitar quando artista não é dono do show", async () => {
    const reqRepo = new MockRequestRepo();
    const showRepo = new MockShowRepo();
    showRepo.add(new Show("show-1", "artist-1", new Date(), new ShowDuration(4), "active"));

    const useCase = new MarkSongAsPlayedUseCase(reqRepo as any, showRepo as any, mockLogger as any);
    await expect(
      useCase.execute({ showId: "show-1", songId: "song-1", artistId: "intruso" })
    ).rejects.toThrow(UnauthorizedError);
    expect(reqRepo.lastUpdate).toBeNull();
  });

  test("deve lançar NotFound quando show não existe", async () => {
    const reqRepo = new MockRequestRepo();
    const showRepo = new MockShowRepo();
    const useCase = new MarkSongAsPlayedUseCase(reqRepo as any, showRepo as any, mockLogger as any);
    await expect(useCase.execute({ showId: "nope", songId: "s", artistId: "a" })).rejects.toThrow(
      NotFoundError
    );
  });
});
