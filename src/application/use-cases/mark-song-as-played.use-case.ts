import type { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import type { IShowRepository } from "../../core/ports/show.repository";
import type { ILogger } from "../../core/ports/logger.port";
import { NotFoundError, UnauthorizedError } from "../../core/errors/app-error";

export interface MarkSongAsPlayedInput {
  showId: string;
  songId: string;
  artistId: string;
}

/**
 * Caso de Uso: Marcar música como tocada.
 * Aplica RN03: todos os pedidos pendentes daquela música no show vão para 'played'.
 */
export class MarkSongAsPlayedUseCase {
  constructor(
    private requestRepository: IMusicRequestRepository,
    private showRepository: IShowRepository,
    private logger: ILogger
  ) {}

  async execute(input: MarkSongAsPlayedInput): Promise<void> {
    const show = await this.showRepository.findById(input.showId);
    if (!show) {
      throw new NotFoundError("Show não encontrado.");
    }
    if (show.artistId !== input.artistId) {
      this.logger.warn(`Tentativa de marcar música como tocada em show de outro artista`, {
        showId: input.showId, attemptedBy: input.artistId
      });
      throw new UnauthorizedError("Você não tem permissão para alterar este show.");
    }

    await this.requestRepository.updateStatusBySong(input.showId, input.songId, 'played');
    this.logger.info(`Música ${input.songId} marcada como tocada no show ${input.showId}`);
  }
}
