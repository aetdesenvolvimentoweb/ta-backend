import { eq, and } from "drizzle-orm";
import { db } from "../client";
import { songs } from "../schema";
import { Song } from "../../../core/entities/song.entity";
import { ISongRepository } from "../../../core/ports/song.repository";

/**
 * Implementação do repositório de Músicas usando Drizzle ORM.
 */
export class DrizzleSongRepository implements ISongRepository {
  
  async save(song: Song): Promise<void> {
    await db.insert(songs).values({
      id: song.id,
      artistId: song.artistId,
      title: song.title,
      originalArtist: song.originalArtist,
      styleId: song.styleId,
      isAvailable: song.isAvailable,
    }).onConflictDoUpdate({
      target: songs.id,
      set: {
        title: song.title,
        originalArtist: song.originalArtist,
        isAvailable: song.isAvailable,
        styleId: song.styleId
      }
    });
  }

  async findById(id: string): Promise<Song | null> {
    const [row] = await db.select().from(songs).where(eq(songs.id, id));
    if (!row) return null;

    return new Song(
      row.id,
      row.artistId,
      row.title,
      row.originalArtist,
      row.styleId || undefined,
      row.isAvailable
    );
  }

  async findByArtistId(artistId: string): Promise<Song[]> {
    const rows = await db.select().from(songs).where(eq(songs.artistId, artistId));
    return rows.map(row => new Song(
      row.id,
      row.artistId,
      row.title,
      row.originalArtist,
      row.styleId || undefined,
      row.isAvailable
    ));
  }

  async delete(id: string): Promise<void> {
    await db.delete(songs).where(eq(songs.id, id));
  }
}
