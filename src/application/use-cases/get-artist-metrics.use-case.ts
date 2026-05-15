import type { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import type { IShowRepository } from "../../core/ports/show.repository";
import type { ILogger } from "../../core/ports/logger.port";
import { Money } from "../../core/value-objects/money.vo";

export interface ArtistMetrics {
  totalEarned: number;
  artistShare: number;
  appShare: number;
  totalRequestsPlayed: number;
  appCommissionPercent: number;
}

const APP_COMMISSION_PERCENT = 0.15;

/**
 * Caso de Uso: Métricas financeiras consolidadas do artista (RN02).
 * Considera histórico completo de pedidos tocados em todos os shows.
 */
export class GetArtistMetricsUseCase {
  constructor(
    private requestRepository: IMusicRequestRepository,
    private _showRepository: IShowRepository,
    private logger: ILogger
  ) {}

  async execute(artistId: string): Promise<ArtistMetrics> {
    const agg = await this.requestRepository.aggregateArtistMetrics(artistId);

    const appShareCents = Math.round(agg.totalEarnedCents * APP_COMMISSION_PERCENT);
    const artistShareCents = agg.totalEarnedCents - appShareCents;

    this.logger.info("Métricas do artista calculadas", { artistId, played: agg.totalRequestsPlayed });

    return {
      totalEarned: new Money(agg.totalEarnedCents).toReal(),
      artistShare: new Money(artistShareCents).toReal(),
      appShare: new Money(appShareCents).toReal(),
      totalRequestsPlayed: agg.totalRequestsPlayed,
      appCommissionPercent: APP_COMMISSION_PERCENT,
    };
  }
}
