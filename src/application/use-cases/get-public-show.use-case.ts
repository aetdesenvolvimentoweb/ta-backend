import { NotFoundError } from "../../core/errors/app-error";
import type { IArtistRepository } from "../../core/ports/artist.repository";
import type { ILogger } from "../../core/ports/logger.port";
import type { IShowRepository } from "../../core/ports/show.repository";
import type { ISongRepository } from "../../core/ports/song.repository";
import type { IStyleRepository } from "../../core/ports/style.repository";

export interface PublicSong {
  id: string;
  title: string;
  originalArtist: string;
  styleName: string | null;
}

export interface PublicShowResult {
  show: {
    id: string;
    status: string;
    startTime: string;
  };
  artist: {
    id: string;
    name: string;
    socials: Record<string, string>;
    canReceiveTips: boolean;
  };
  songs: PublicSong[];
}

/**
 * Retorna os dados públicos de um show — usados pela página do fã (via QR Code).
 * Agrega show + artista + repertório disponível em uma única consulta.
 */
export class GetPublicShowUseCase {
  constructor(
    private showRepository: IShowRepository,
    private artistRepository: IArtistRepository,
    private songRepository: ISongRepository,
    private styleRepository: IStyleRepository,
    private logger: ILogger
  ) {}

  async execute(showId: string): Promise<PublicShowResult> {
    const show = await this.showRepository.findById(showId);
    if (!show) throw new NotFoundError("Show não encontrado.");

    const [artist, allSongs] = await Promise.all([
      this.artistRepository.findById(show.artistId),
      this.songRepository.findByArtistId(show.artistId),
    ]);

    if (!artist) {
      this.logger.error(`Show ${showId} aponta para artista inexistente ${show.artistId}`);
      throw new NotFoundError("Show não encontrado.");
    }

    const available = allSongs.filter((s) => s.isAvailable);

    const styleIds = [...new Set(available.map((s) => s.styleId).filter(Boolean) as string[])];
    const stylesList = styleIds.length > 0 ? await this.styleRepository.findByIds(styleIds) : [];
    const stylesMap = new Map(stylesList.map((s) => [s.id, s.name]));

    return {
      show: { id: show.id, status: show.status, startTime: show.startTime.toISOString() },
      artist: {
        id: artist.id,
        name: artist.name,
        socials: artist.socials,
        canReceiveTips: artist.canReceiveTips(),
      },
      songs: available.map((s) => ({
        id: s.id,
        title: s.title,
        originalArtist: s.originalArtist,
        styleName: s.styleId ? (stylesMap.get(s.styleId) ?? null) : null,
      })),
    };
  }
}
