import type { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import type { IShowRepository } from "../../core/ports/show.repository";
import type { ILogger } from "../../core/ports/logger.port";
import { NotFoundError, BusinessRuleError, UnauthorizedError } from "../../core/errors/app-error";

export interface CancelMusicRequestInput {
  requestId: string;
  artistId: string;
}

/**
 * Caso de Uso: Cancelar um pedido de música (RN05).
 * Apenas o artista dono do show pode cancelar.
 */
export class CancelMusicRequestUseCase {
  constructor(
    private requestRepository: IMusicRequestRepository,
    private showRepository: IShowRepository,
    private logger: ILogger
  ) {}

  async execute(input: CancelMusicRequestInput): Promise<void> {
    const request = await this.requestRepository.findById(input.requestId);
    if (!request) {
      throw new NotFoundError("Pedido não encontrado.");
    }

    const show = await this.showRepository.findById(request.showId);
    if (!show) {
      throw new NotFoundError("Show do pedido não encontrado.");
    }
    if (show.artistId !== input.artistId) {
      this.logger.warn(`Tentativa de cancelar pedido de outro artista`, {
        requestId: input.requestId, attemptedBy: input.artistId
      });
      throw new UnauthorizedError("Você não tem permissão para cancelar este pedido.");
    }

    if (request.status === 'played') {
      throw new BusinessRuleError("Não é possível cancelar um pedido que já foi tocado.");
    }

    request.cancel();
    // Estorno via gateway de pagamento será disparado aqui no futuro (RN05).
    await this.requestRepository.save(request);
    this.logger.info(`Pedido ${input.requestId} cancelado pelo artista ${input.artistId}`);
  }
}
