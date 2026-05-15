import { Song } from "../../core/entities/song.entity";
import { NotFoundError, UnauthorizedError } from "../../core/errors/app-error";
import type { ISongRepository } from "../../core/ports/song.repository";
import type { IStyleRepository } from "../../core/ports/style.repository";
import type { ILogger } from "../../core/ports/logger.port";

/**
 * Caso de Uso: Listar o repertório de um artista.
 */
export class GetRepertoireUseCase {
  constructor(
    private songRepository: ISongRepository,
    private logger: ILogger
  ) {}

  async execute(artistId: string): Promise<Song[]> {
    const songs = await this.songRepository.findByArtistId(artistId);
    this.logger.info(`Repertório listado para artista ${artistId}: ${songs.length} músicas`);
    return songs;
  }
}

export interface AddSongInput {
  artistId: string;
  title: string;
  originalArtist: string;
  styleName: string;
}

/**
 * Caso de Uso: Adicionar música ao repertório do artista.
 */
export class AddSongUseCase {
  constructor(
    private songRepository: ISongRepository,
    private styleRepository: IStyleRepository,
    private logger: ILogger
  ) {}

  async execute(input: AddSongInput): Promise<Song> {
    // 1. Verificar/Buscar o estilo musical
    let style = await this.styleRepository.findByName(input.styleName);
    
    if (!style) {
      this.logger.info(`Novo estilo sugerido por artista: ${input.styleName}`);
      // Se não existe, cria um novo (Admin receberá notificação futuramente - RN10)
      style = { id: crypto.randomUUID(), name: input.styleName };
      await this.styleRepository.save(style);
    }

    // 2. Criar e salvar a música
    const song = new Song(
      crypto.randomUUID(),
      input.artistId,
      input.title,
      input.originalArtist,
      style.id,
      true // Disponível por padrão
    );

    await this.songRepository.save(song);

    return song;
  }
}

export interface ToggleSongAvailabilityInput {
  songId: string;
  isAvailable: boolean;
  artistId: string;
}

/**
 * Caso de Uso: Alternar disponibilidade da música (RN05).
 */
export class ToggleSongAvailabilityUseCase {
  constructor(
    private songRepository: ISongRepository,
    private logger: ILogger
  ) {}

  async execute(input: ToggleSongAvailabilityInput): Promise<void> {
    const song = await this.songRepository.findById(input.songId);
    if (!song) {
      throw new NotFoundError("Música não encontrada.");
    }
    if (song.artistId !== input.artistId) {
      this.logger.warn(`Tentativa de alterar música de outro artista`, {
        songId: input.songId, attemptedBy: input.artistId
      });
      throw new UnauthorizedError("Você não tem permissão para alterar esta música.");
    }

    song.setAvailability(input.isAvailable);
    await this.songRepository.save(song);
    this.logger.info(`Disponibilidade da música ${song.title} alterada para: ${input.isAvailable}`);
  }
}
