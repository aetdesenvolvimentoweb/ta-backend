import { IShowRepository } from "../../core/ports/show.repository";
import { IMusicRequestRepository } from "../../core/ports/music-request.repository";

/**
 * Caso de Uso: Encerrar um show manualmente.
 * Ao encerrar, os pedidos pendentes são cancelados.
 */
export class FinishShowUseCase {
  constructor(
    private showRepository: IShowRepository,
    private requestRepository: IMusicRequestRepository
  ) {}

  async execute(showId: string): Promise<void> {
    const show = await this.showRepository.findById(showId);
    
    if (!show) {
      throw new Error("Show não encontrado.");
    }

    if (show.status !== 'active') {
      throw new Error("Este show já não está mais ativo.");
    }

    // 1. Marcar show como finalizado
    show.finish();
    await this.showRepository.save(show);

    // 2. Cancelar pedidos que ficaram pendentes (RN: Opcional, mas boa prática)
    const pendingRequests = await this.requestRepository.findByShowId(showId);
    for (const req of pendingRequests) {
      if (req.status === 'pending') {
        req.cancel();
        await this.requestRepository.save(req);
      }
    }
  }
}
