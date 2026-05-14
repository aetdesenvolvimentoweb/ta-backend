import { MusicRequest } from "../../core/entities/music-request.entity";
import type { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import type { ILogger } from "../../core/ports/logger.port";

/**
 * Caso de Uso: Listar pedidos de um show.
 * Aplica a regra RN02: Ordenação por Valor e depois por Chegada.
 */
export class GetShowRequestsUseCase {
  constructor(
    private requestRepository: IMusicRequestRepository,
    private logger: ILogger
  ) {}

  async execute(showId: string): Promise<MusicRequest[]> {
    const requests = await this.requestRepository.findByShowId(showId);

    // RN02: Ordenação customizada
    // 1. Gorjeta (Maior primeiro)
    // 2. Data de Criação (Mais antigo primeiro)
    return requests.sort((a, b) => {
      // Comparar por valor da gorjeta
      if (b.tip.amountInCents !== a.tip.amountInCents) {
        return b.tip.amountInCents - a.tip.amountInCents;
      }
      
      // Se o valor for igual, o mais antigo tem prioridade
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }
}
