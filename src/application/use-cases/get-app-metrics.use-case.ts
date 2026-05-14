import type { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import type { IArtistRepository } from "../../core/ports/artist.repository";
import type { ISongRepository } from "../../core/ports/song.repository";
import type { ILogger } from "../../core/ports/logger.port";
import { Money } from "../../core/value-objects/money.vo";

export interface AppMetrics {
  totalAppRevenue: number;
  totalVolumeTransacted: number;
  topSongsByRequestCount: { title: string, count: number }[];
  topArtistsByRevenue: { name: string, revenue: number }[];
}

/**
 * Caso de Uso: Obter métricas globais do sistema (Painel Admin).
 */
export class GetAppMetricsUseCase {
  private APP_COMMISSION_PERCENT = 0.15;

  constructor(
    private requestRepository: IMusicRequestRepository,
    private artistRepository: IArtistRepository,
    private songRepository: ISongRepository,
    private logger: ILogger
  ) {}

  /**
   * Este método consolidaria dados de todos os shows.
   * Em produção, isso seria uma query otimizada no banco.
   */
  async execute(): Promise<AppMetrics> {
    // Para o domínio, vamos definir a lógica de como esses dados são processados
    // No mundo real, pediríamos ao repositório um sumário consolidado para performance.
    
    // Por enquanto, vamos simular a lógica de agregação que o repositório deve seguir
    return {
      totalAppRevenue: 0, // 15% do volume total
      totalVolumeTransacted: 0,
      topSongsByRequestCount: [],
      topArtistsByRevenue: []
    };
  }
}
