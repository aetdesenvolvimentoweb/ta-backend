import { MusicRequest } from "../../core/entities/music-request.entity";
import { BusinessRuleError, NotFoundError } from "../../core/errors/app-error";
import type { IArtistRepository } from "../../core/ports/artist.repository";
import type { ILogger } from "../../core/ports/logger.port";
import type { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import type { IProfanityFilter } from "../../core/ports/profanity-filter.port";
import type { IShowRepository } from "../../core/ports/show.repository";
import type { ISongRepository } from "../../core/ports/song.repository";
import { Money } from "../../core/value-objects/money.vo";

export interface RequestMusicInput {
  showId: string;
  songId: string;
  customerName: string;
  customerSessionId: string;
  message?: string;
  tipAmountInCents: number;
}

/**
 * Caso de Uso: Solicitar uma música.
 * Aplica RN09 (1 pedido gratuito por sessão), RN08 (moderação) e RN15 (tip exige conta de pagamento conectada).
 */
export class RequestMusicUseCase {
  constructor(
    private requestRepository: IMusicRequestRepository,
    private showRepository: IShowRepository,
    private songRepository: ISongRepository,
    private artistRepository: IArtistRepository,
    private logger: ILogger,
    private profanityFilter: IProfanityFilter
  ) {}

  async execute(input: RequestMusicInput): Promise<MusicRequest> {
    const [show, song] = await Promise.all([
      this.showRepository.findById(input.showId),
      this.songRepository.findById(input.songId),
    ]);

    if (!show || show.status !== "active" || show.isExpired()) {
      throw new BusinessRuleError("Este show não está aceitando pedidos no momento.");
    }

    if (new Date() < show.startTime) {
      throw new BusinessRuleError(
        "Este show ainda não começou. Aguarde o início para fazer pedidos."
      );
    }

    if (!song || !song.isAvailable) {
      throw new NotFoundError("Música indisponível no momento.");
    }

    if (song.artistId !== show.artistId) {
      throw new BusinessRuleError("Esta música não pertence ao repertório do artista deste show.");
    }

    const tip = new Money(input.tipAmountInCents);
    if (tip.amountInCents === 0) {
      const freeRequestsCount = await this.requestRepository.countFreeRequestsByCustomer(
        input.showId,
        input.customerSessionId
      );

      if (freeRequestsCount >= 1) {
        throw new BusinessRuleError(
          "Você já utilizou seu pedido gratuito para este show (RN09). Adicione uma gorjeta para pedir mais!"
        );
      }
    } else {
      const artist = await this.artistRepository.findById(show.artistId);
      if (!artist || !artist.canReceiveTips()) {
        this.logger.warn(
          `Tentativa de gorjeta para artista ${show.artistId} sem conta de pagamento conectada (RN15).`
        );
        throw new BusinessRuleError(
          "Este artista ainda não habilitou gorjetas. Apenas pedidos gratuitos estão disponíveis no momento."
        );
      }
    }

    const sanitizedMessage = input.message ? this.profanityFilter.clean(input.message) : null;

    const request = new MusicRequest(
      crypto.randomUUID(),
      input.showId,
      input.songId,
      input.customerName,
      input.customerSessionId,
      sanitizedMessage,
      tip,
      "pending"
    );

    await this.requestRepository.save(request);

    return request;
  }
}
