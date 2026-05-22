import { describe, expect, test } from "bun:test";
import type { Song } from "../../core/entities/song.entity";
import { UnauthorizedError } from "../../core/errors/app-error";
import {
  AddSongUseCase,
  GetRepertoireUseCase,
  ToggleSongAvailabilityUseCase,
} from "./manage-repertoire.use-case";

class MockSongRepo {
  private songs: Song[] = [];
  async save(s: Song) {
    const idx = this.songs.findIndex((i) => i.id === s.id);
    if (idx >= 0) this.songs[idx] = s;
    else this.songs.push(s);
  }
  async findById(id: string) {
    return this.songs.find((s) => s.id === id) || null;
  }
  async findByArtistId(artistId: string) {
    return this.songs.filter((s) => s.artistId === artistId);
  }
  async delete() {}
}

class MockStyleRepo {
  private styles: any[] = [];
  async findByName(n: string) {
    return this.styles.find((s) => s.name === n) || null;
  }
  async save(s: any) {
    this.styles.push(s);
  }
  async findAll() {
    return [];
  }
  async findById() {
    return null;
  }
  async delete() {}
  async mergeStyles() {}
}

const mockLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };

describe("Manage Repertoire Use Cases", () => {
  test("deve adicionar uma música ao repertório", async () => {
    const songRepo = new MockSongRepo();
    const styleRepo = new MockStyleRepo();
    const useCase = new AddSongUseCase(songRepo as any, styleRepo as any, mockLogger as any);

    const song = await useCase.execute({
      artistId: "artist-1",
      title: "Evidências",
      originalArtist: "Chitãozinho & Xororó",
      styleName: "Sertanejo",
    });

    expect(song.title).toBe("Evidências");
    expect(song.isAvailable).toBe(true);
  });

  test("deve listar o repertório de um artista", async () => {
    const songRepo = new MockSongRepo();
    const addSong = new AddSongUseCase(
      songRepo as any,
      new MockStyleRepo() as any,
      mockLogger as any
    );
    const getRepertoire = new GetRepertoireUseCase(songRepo as any, mockLogger as any);

    await addSong.execute({
      artistId: "artist-1",
      title: "Canção A",
      originalArtist: "Artista X",
      styleName: "MPB",
    });
    await addSong.execute({
      artistId: "artist-1",
      title: "Canção B",
      originalArtist: "Artista Y",
      styleName: "Rock",
    });
    await addSong.execute({
      artistId: "artist-2",
      title: "Outra",
      originalArtist: "Artista Z",
      styleName: "Pop",
    });

    const songs = await getRepertoire.execute("artist-1");
    expect(songs.length).toBe(2);
    expect(songs.every((s) => s.artistId === "artist-1")).toBe(true);
  });

  test("deve alternar disponibilidade da música quando é do próprio artista", async () => {
    const songRepo = new MockSongRepo();
    const useCase = new AddSongUseCase(
      songRepo as any,
      new MockStyleRepo() as any,
      mockLogger as any
    );
    const toggle = new ToggleSongAvailabilityUseCase(songRepo as any, mockLogger as any);

    const song = await useCase.execute({
      artistId: "artist-1",
      title: "Música X",
      originalArtist: "Artista Y",
      styleName: "Rock",
    });

    await toggle.execute({ songId: song.id, isAvailable: false, artistId: "artist-1" });

    const updated = await songRepo.findById(song.id);
    expect(updated?.isAvailable).toBe(false);
  });

  test("deve rejeitar toggle de música de outro artista", async () => {
    const songRepo = new MockSongRepo();
    const add = new AddSongUseCase(songRepo as any, new MockStyleRepo() as any, mockLogger as any);
    const toggle = new ToggleSongAvailabilityUseCase(songRepo as any, mockLogger as any);

    const song = await add.execute({
      artistId: "artist-1",
      title: "Música X",
      originalArtist: "Artista Y",
      styleName: "Rock",
    });

    await expect(
      toggle.execute({ songId: song.id, isAvailable: false, artistId: "artist-2" })
    ).rejects.toThrow(UnauthorizedError);
  });
});
