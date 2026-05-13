import { MusicRequest } from "../../core/entities/music-request.entity";
import { BusinessRuleError, NotFoundError } from "../../core/errors/app-error";
import { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import { IShowRepository } from "../../core/ports/show.repository";
import { ISongRepository } from "../../core/ports/song.repository";
import { ILogger } from "../../core/ports/logger.port";
import { Money } from "../../core/value-objects/money.vo";

export interface RequestMusicInput {
  showId: string;
  songId: string;
  customerName: string;
  customerSessionId: string; // ID da sessão/browser para controle de RN09
  message?: string;
  tipAmountInCents: number;
}

/**
 * Caso de Uso: Solicitar uma música.
 * Aplica a regra RN09 (1 pedido gratuito por show).
 */
export class RequestMusicUseCase {
  constructor(
    private requestRepository: IMusicRequestRepository,
    private showRepository: IShowRepository,
    private songRepository: ISongRepository,
    private logger: ILogger
  ) {}

  async execute(input: RequestMusicInput): Promise<MusicRequest> {
    // 1. Validar Show
    const show = await this.showRepository.findById(input.showId);
    if (!show || show.status !== 'active' || show.isExpired()) {
      throw new BusinessRuleError("Este show não está aceitando pedidos no momento.");
    }

    // 2. Validar Música
    const song = await this.songRepository.findById(input.songId);
    if (!song || !song.isAvailable) {
      throw new NotFoundError("Música indisponível no momento.");
    }

    // 3. RN09 - Validar Pedido Gratuito
    const tip = new Money(input.tipAmountInCents);
    if (tip.amountInCents === 0) {
      const freeRequestsCount = await this.requestRepository.countFreeRequestsByCustomer(
        input.showId, 
        input.customerSessionId
      );
      
      if (freeRequestsCount >= 1) {
        throw new Error("Você já utilizou seu pedido gratuito para este show (RN09). Adicione uma gorjeta para pedir mais!");
      }
    }

    // 4. Criar Pedido
    const request = new MusicRequest(
      crypto.randomUUID(),
      input.showId,
      input.songId,
      input.customerName,
      input.message ?? null,
      tip,
      'pending'
    );

    await this.requestRepository.save(request);

    return request;
  }
}
