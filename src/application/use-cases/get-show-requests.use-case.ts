import { MusicRequest } from "../../core/entities/music-request.entity";
import type { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import type { IShowRepository } from "../../core/ports/show.repository";
import type { ILogger } from "../../core/ports/logger.port";
import { NotFoundError, UnauthorizedError } from "../../core/errors/app-error";

export interface GetShowRequestsInput {
  showId: string;
  artistId: string;
}

/**
 * Caso de Uso: Listar pedidos de um show.
 * Aplica RN02 (ordenação por gorjeta + chegada) e valida ownership.
 */
export class GetShowRequestsUseCase {
  constructor(
    private requestRepository: IMusicRequestRepository,
    private showRepository: IShowRepository,
    private logger: ILogger
  ) {}

  async execute(input: GetShowRequestsInput): Promise<MusicRequest[]> {
    const show = await this.showRepository.findById(input.showId);
    if (!show) {
      throw new NotFoundError("Show não encontrado.");
    }
    if (show.artistId !== input.artistId) {
      this.logger.warn(`Tentativa de listar pedidos de show de outro artista`, {
        showId: input.showId, attemptedBy: input.artistId
      });
      throw new UnauthorizedError("Você não tem permissão para visualizar este show.");
    }

    const requests = await this.requestRepository.findByShowId(input.showId);

    return requests.sort((a, b) => {
      if (b.tip.amountInCents !== a.tip.amountInCents) {
        return b.tip.amountInCents - a.tip.amountInCents;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }
}
