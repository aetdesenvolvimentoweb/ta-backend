import type { Song } from "../entities/song.entity";

/**
 * Interface de Repositório para a entidade Song.
 */
export interface ISongRepository {
  save(song: Song): Promise<void>;
  findById(id: string): Promise<Song | null>;
  findByIds(ids: string[]): Promise<Song[]>;
  findByArtistId(artistId: string): Promise<Song[]>;
  delete(id: string): Promise<void>;
}
