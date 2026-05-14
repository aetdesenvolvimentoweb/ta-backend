import type { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import type { IShowRepository } from "../../core/ports/show.repository";
import type { ILogger } from "../../core/ports/logger.port";
import { Money } from "../../core/value-objects/money.vo";

export interface ArtistMetrics {
  totalEarned: number; // Em reais para exibição fácil
  artistShare: number;
  appShare: number;
  totalRequestsPlayed: number;
}

/**
 * Caso de Uso: Obter métricas financeiras do artista (RN02).
 */
export class GetArtistMetricsUseCase {
  private APP_COMMISSION_PERCENT = 0.15; // 15% conforme estratégia

  constructor(
    private requestRepository: IMusicRequestRepository,
    private showRepository: IShowRepository,
    private logger: ILogger
  ) {}

  async execute(artistId: string): Promise<ArtistMetrics> {
    // 1. Buscar todos os shows do artista para consolidar (ou apenas o ativo? 
    // RN02 diz "métrica para o artista", vamos consolidar tudo que foi 'played')
    
    // Por enquanto, vamos simular a busca de todos os pedidos 'played' vinculados a este artista
    // Em uma implementação real, o repositório faria esse JOIN/Filtro.
    
    // Para o Use Case, vamos assumir que o repositório nos devolve os pedidos de um show ou filtro
    const activeShow = await this.showRepository.findActiveByArtistId(artistId);
    if (!activeShow) {
       return { totalEarned: 0, artistShare: 0, appShare: 0, totalRequestsPlayed: 0 };
    }

    const requests = await this.requestRepository.findByShowId(activeShow.id);
    const playedRequests = requests.filter(r => r.status === 'played');

    const totalCents = playedRequests.reduce((sum, req) => sum + req.tip.amountInCents, 0);
    const totalMoney = new Money(totalCents);

    const appShareCents = Math.round(totalCents * this.APP_COMMISSION_PERCENT);
    const artistShareCents = totalCents - appShareCents;

    return {
      totalEarned: totalMoney.toReal(),
      artistShare: new Money(artistShareCents).toReal(),
      appShare: new Money(appShareCents).toReal(),
      totalRequestsPlayed: playedRequests.length
    };
  }
}
