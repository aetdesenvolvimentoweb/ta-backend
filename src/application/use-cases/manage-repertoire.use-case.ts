import { Song } from "../../core/entities/song.entity";
import { NotFoundError } from "../../core/errors/app-error";
import { ISongRepository } from "../../core/ports/song.repository";
import { IStyleRepository } from "../../core/ports/style.repository";
import { ILogger } from "../../core/ports/logger.port";

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

/**
 * Caso de Uso: Alternar disponibilidade da música (RN05/RN08).
 */
export class ToggleSongAvailabilityUseCase {
  constructor(
    private songRepository: ISongRepository,
    private logger: ILogger
  ) {}

  async execute(songId: string, isAvailable: boolean): Promise<void> {
    const song = await this.songRepository.findById(songId);
    if (!song) {
      throw new NotFoundError("Música não encontrada.");
    }

    song.setAvailability(isAvailable);
    await this.songRepository.save(song);
    this.logger.info(`Disponibilidade da música ${song.title} alterada para: ${isAvailable}`);
  }
}
