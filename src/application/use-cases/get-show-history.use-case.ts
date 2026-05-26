import { NotFoundError, UnauthorizedError } from "../../core/errors/app-error";
import type { ILogger } from "../../core/ports/logger.port";
import type { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import type { IShowRepository } from "../../core/ports/show.repository";
import type { ISongRepository } from "../../core/ports/song.repository";
import { Money } from "../../core/value-objects/money.vo";

const APP_COMMISSION_PERCENT = 0.15;

export interface ShowHistoryItem {
  id: string;
  startTime: Date;
  durationHours: number;
  status: "finished" | "expired";
  totalRequests: number;
  totalPlayed: number;
  totalTipsInReal: number;
  artistShareInReal: number;
}

/**
 * Caso de Uso: Histórico de shows encerrados/expirados de um artista (RN02).
 * Retorna os shows ordenados do mais recente para o mais antigo, com métricas
 * agregadas calculadas no banco.
 */
export class GetShowHistoryUseCase {
  constructor(
    private showRepository: IShowRepository,
    private logger: ILogger
  ) {}

  async execute(artistId: string): Promise<ShowHistoryItem[]> {
    const history = await this.showRepository.findHistoryByArtistId(artistId);

    this.logger.info("Histórico de shows recuperado", { artistId, count: history.length });

    return history.map(({ show, totalRequests, totalPlayed, totalTipsGrossCents }) => {
      const status = show.status as "finished" | "expired";
      const artistShareCents = Math.round(totalTipsGrossCents * (1 - APP_COMMISSION_PERCENT));
      return {
        id: show.id,
        startTime: show.startTime,
        durationHours: show.duration.hours,
        status,
        totalRequests,
        totalPlayed,
        totalTipsInReal: new Money(totalTipsGrossCents).toReal(),
        artistShareInReal: new Money(artistShareCents).toReal(),
      };
    });
  }
}

export interface ShowDetailsRequestItem {
  id: string;
  songId: string;
  songTitle: string;
  songOriginalArtist: string;
  customerName: string;
  message: string | null;
  tipAmountInCents: number;
  status: "pending" | "played" | "cancelled" | "refunded";
  createdAt: Date;
}

export interface ShowDetails {
  id: string;
  startTime: Date;
  durationHours: number;
  status: "active" | "finished" | "expired";
  totalRequests: number;
  totalPlayed: number;
  totalTipsInReal: number;
  artistShareInReal: number;
  requests: ShowDetailsRequestItem[];
}

export interface GetShowDetailsInput {
  showId: string;
  artistId: string;
}

/**
 * Caso de Uso: Detalhes de um show específico (com lista de pedidos hidratada
 * com título da música). Reutilizável para o histórico — valida ownership.
 */
export class GetShowDetailsUseCase {
  constructor(
    private showRepository: IShowRepository,
    private requestRepository: IMusicRequestRepository,
    private songRepository: ISongRepository,
    private logger: ILogger
  ) {}

  async execute(input: GetShowDetailsInput): Promise<ShowDetails> {
    const show = await this.showRepository.findById(input.showId);
    if (!show) {
      throw new NotFoundError("Show não encontrado.");
    }
    if (show.artistId !== input.artistId) {
      this.logger.warn("Tentativa de visualizar detalhes de show de outro artista", {
        showId: input.showId,
        attemptedBy: input.artistId,
      });
      throw new UnauthorizedError("Você não tem permissão para visualizar este show.");
    }

    const requests = await this.requestRepository.findByShowId(input.showId);
    const songIds = Array.from(new Set(requests.map((r) => r.songId)));
    const songs = await this.songRepository.findByIds(songIds);
    const songById = new Map(songs.map((s) => [s.id, s]));

    const totalPlayed = requests.filter((r) => r.status === "played").length;
    const totalTipsGrossCents = requests
      .filter((r) => r.status === "played")
      .reduce((sum, r) => sum + r.tip.amountInCents, 0);
    const artistShareCents = Math.round(totalTipsGrossCents * (1 - APP_COMMISSION_PERCENT));

    return {
      id: show.id,
      startTime: show.startTime,
      durationHours: show.duration.hours,
      status: show.status,
      totalRequests: requests.length,
      totalPlayed,
      totalTipsInReal: new Money(totalTipsGrossCents).toReal(),
      artistShareInReal: new Money(artistShareCents).toReal(),
      requests: requests
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((r) => {
          const song = songById.get(r.songId);
          return {
            id: r.id,
            songId: r.songId,
            songTitle: song?.title ?? "(música removida)",
            songOriginalArtist: song?.originalArtist ?? "",
            customerName: r.customerName,
            message: r.message,
            tipAmountInCents: r.tip.amountInCents,
            status: r.status,
            createdAt: r.createdAt,
          };
        }),
    };
  }
}
