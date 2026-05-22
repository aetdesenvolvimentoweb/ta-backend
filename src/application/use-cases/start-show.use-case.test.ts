import { describe, expect, test } from "bun:test";
import { Artist } from "../../core/entities/artist.entity";
import { Show } from "../../core/entities/show.entity";
import { Email } from "../../core/value-objects/email.vo";
import { ShowDuration } from "../../core/value-objects/show-duration.vo";
import { StartShowUseCase } from "./start-show.use-case";

class InMemoryShowRepository {
  private shows: Show[] = [];
  async save(show: Show): Promise<void> {
    const index = this.shows.findIndex((s) => s.id === show.id);
    if (index >= 0) this.shows[index] = show;
    else this.shows.push(show);
  }
  async findActiveByArtistId(artistId: string): Promise<Show | null> {
    return this.shows.find((s) => s.artistId === artistId && s.status === "active") || null;
  }
  async findById(id: string): Promise<Show | null> {
    return null;
  }
  async findAll(): Promise<Show[]> {
    return [];
  }
  async markExpiredShows(): Promise<void> {}
}

class InMemoryArtistRepository {
  async findById(id: string): Promise<Artist | null> {
    if (id === "artist-1") return new Artist(id, "Artista Teste", new Email("teste@teste.com"));
    return null;
  }
  async save(artist: Artist): Promise<void> {}
  async findByEmail(email: string): Promise<Artist | null> {
    return null;
  }
  async delete(id: string): Promise<void> {}
}

const mockLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };

describe("StartShow Use Case", () => {
  test("deve iniciar um show com sucesso", async () => {
    const showRepo = new InMemoryShowRepository();
    const artistRepo = new InMemoryArtistRepository();
    const useCase = new StartShowUseCase(showRepo as any, artistRepo as any, mockLogger as any);

    const show = await useCase.execute({ artistId: "artist-1", durationHours: 4 });

    expect(show.status).toBe("active");
    expect(show.artistId).toBe("artist-1");
  });

  test("deve impedir novo show se já houver um ativo", async () => {
    const showRepo = new InMemoryShowRepository();
    const artistRepo = new InMemoryArtistRepository();
    const useCase = new StartShowUseCase(showRepo as any, artistRepo as any, mockLogger as any);

    await useCase.execute({ artistId: "artist-1", durationHours: 4 });

    await expect(useCase.execute({ artistId: "artist-1", durationHours: 4 })).rejects.toThrow(
      "já possui um show ativo"
    );
  });

  test("deve permitir novo show se o anterior estiver expirado", async () => {
    const showRepo = new InMemoryShowRepository();
    const artistRepo = new InMemoryArtistRepository();
    const useCase = new StartShowUseCase(showRepo as any, artistRepo as any, mockLogger as any);

    // Criar um show que começou há 10 horas com duração de 4h (já expirado)
    const expiredShow = new Show(
      "old-id",
      "artist-1",
      new Date(Date.now() - 10 * 60 * 60 * 1000),
      new ShowDuration(4)
    );
    await showRepo.save(expiredShow);

    const newShow = await useCase.execute({ artistId: "artist-1", durationHours: 4 });
    expect(newShow.id).not.toBe(expiredShow.id);
    expect(newShow.status).toBe("active");
  });
});
