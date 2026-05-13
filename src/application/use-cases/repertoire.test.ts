import { expect, test, describe } from "bun:test";
import { AddSongUseCase, ToggleSongAvailabilityUseCase } from "./manage-repertoire.use-case";
import { Song } from "../../core/entities/song.entity";

class MockSongRepo {
  private songs: Song[] = [];
  async save(s: Song) {
    const idx = this.songs.findIndex(i => i.id === s.id);
    if (idx >= 0) this.songs[idx] = s;
    else this.songs.push(s);
  }
  async findById(id: string) { return this.songs.find(s => s.id === id) || null; }
  async findByArtistId() { return []; }
  async delete() {}
}

class MockStyleRepo {
  private styles: any[] = [];
  async findByName(n: string) { return this.styles.find(s => s.name === n) || null; }
  async save(s: any) { this.styles.push(s); }
  async findAll() { return []; }
  async findById() { return null; }
  async delete() {}
  async mergeStyles() {}
}

describe("Manage Repertoire Use Cases", () => {
  test("deve adicionar uma música ao repertório", async () => {
    const songRepo = new MockSongRepo();
    const styleRepo = new MockStyleRepo();
    const useCase = new AddSongUseCase(songRepo as any, styleRepo as any);

    const song = await useCase.execute({
      artistId: "artist-1",
      title: "Evidências",
      originalArtist: "Chitãozinho & Xororó",
      styleName: "Sertanejo"
    });

    expect(song.title).toBe("Evidências");
    expect(song.isAvailable).toBe(true);
  });

  test("deve alternar disponibilidade da música", async () => {
    const songRepo = new MockSongRepo();
    const useCase = new AddSongUseCase(songRepo as any, new MockStyleRepo() as any);
    const toggle = new ToggleSongAvailabilityUseCase(songRepo as any);

    const song = await useCase.execute({
      artistId: "artist-1",
      title: "Música X",
      originalArtist: "Artista Y",
      styleName: "Rock"
    });

    await toggle.execute(song.id, false);
    
    const updated = await songRepo.findById(song.id);
    expect(updated?.isAvailable).toBe(false);
  });
});
