import type { IShowRepository } from "../../core/ports/show.repository";
import type { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import type { ILogger } from "../../core/ports/logger.port";
import { NotFoundError, BusinessRuleError, UnauthorizedError } from "../../core/errors/app-error";

export interface FinishShowInput {
  showId: string;
  artistId: string;
}

/**
 * Caso de Uso: Encerrar um show manualmente.
 * Ao encerrar, os pedidos pendentes são cancelados.
 */
export class FinishShowUseCase {
  constructor(
    private showRepository: IShowRepository,
    private requestRepository: IMusicRequestRepository,
    private logger: ILogger
  ) {}

  async execute(input: FinishShowInput): Promise<void> {
    const show = await this.showRepository.findById(input.showId);

    if (!show) {
      throw new NotFoundError("Show não encontrado.");
    }

    if (show.artistId !== input.artistId) {
      this.logger.warn(`Tentativa de finalizar show de outro artista`, { showId: input.showId, attemptedBy: input.artistId });
      throw new UnauthorizedError("Você não tem permissão para finalizar este show.");
    }

    if (show.status !== 'active') {
      throw new BusinessRuleError("Este show já não está mais ativo.");
    }

    // 1. Marcar show como finalizado
    show.finish();
    await this.showRepository.save(show);

    // 2. Cancelar pedidos que ficaram pendentes (RN: Opcional, mas boa prática)
    const pendingRequests = await this.requestRepository.findByShowId(input.showId);
    for (const req of pendingRequests) {
      if (req.status === 'pending') {
        req.cancel();
        await this.requestRepository.save(req);
      }
    }

    this.logger.info(`Show ${input.showId} finalizado pelo artista ${input.artistId}`);
  }
}
