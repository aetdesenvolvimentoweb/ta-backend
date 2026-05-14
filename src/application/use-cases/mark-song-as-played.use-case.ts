import type { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import type { ILogger } from "../../core/ports/logger.port";

export interface MarkSongAsPlayedInput {
  showId: string;
  songId: string;
}

/**
 * Caso de Uso: Marcar música como tocada.
 * Aplica a regra RN03: Todos os pedidos pendentes daquela música no show são atualizados.
 */
export class MarkSongAsPlayedUseCase {
  constructor(
    private requestRepository: IMusicRequestRepository,
    private logger: ILogger
  ) {}

  async execute(input: MarkSongAsPlayedInput): Promise<void> {
    // Aplica a regra RN03: Atualiza todos os pedidos da mesma música para 'played'
    await this.requestRepository.updateStatusBySong(
      input.showId, 
      input.songId, 
      'played'
    );
    this.logger.info(`Música ${input.songId} marcada como tocada no show ${input.showId}`);
  }
}
