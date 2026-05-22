import type { IArtistRepository } from "../../core/ports/artist.repository";
import type { ILogger } from "../../core/ports/logger.port";
import type { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import type { ISongRepository } from "../../core/ports/song.repository";
import { Money } from "../../core/value-objects/money.vo";

export interface AppMetrics {
  totalAppRevenue: number;
  totalArtistsRevenue: number;
  totalVolumeTransacted: number;
  appCommissionPercent: number;
  topSongsByRequestCount: { title: string; count: number }[];
  topArtistsByRevenue: { name: string; revenue: number }[];
}

const APP_COMMISSION_PERCENT = 0.15;

/**
 * Caso de Uso: Métricas globais do sistema (Painel Admin / RN02).
 * Agregação delegada ao repositório (SQL).
 */
export class GetAppMetricsUseCase {
  constructor(
    private requestRepository: IMusicRequestRepository,
    private _artistRepository: IArtistRepository,
    private _songRepository: ISongRepository,
    private logger: ILogger
  ) {}

  async execute(): Promise<AppMetrics> {
    const agg = await this.requestRepository.aggregateAppMetrics();
    const appCents = Math.round(agg.totalVolumeCents * APP_COMMISSION_PERCENT);
    const artistsCents = agg.totalVolumeCents - appCents;

    this.logger.info("Métricas globais calculadas", {
      totalVolumeCents: agg.totalVolumeCents,
      uniqueSongs: agg.topSongsByRequestCount.length,
      uniqueArtists: agg.topArtistsByRevenue.length,
    });

    return {
      totalAppRevenue: new Money(appCents).toReal(),
      totalArtistsRevenue: new Money(artistsCents).toReal(),
      totalVolumeTransacted: new Money(agg.totalVolumeCents).toReal(),
      appCommissionPercent: APP_COMMISSION_PERCENT,
      topSongsByRequestCount: agg.topSongsByRequestCount,
      topArtistsByRevenue: agg.topArtistsByRevenue.map((a) => ({
        name: a.name,
        revenue: new Money(a.revenueCents).toReal(),
      })),
    };
  }
}
