import { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import { ILogger } from "../../core/ports/logger.port";
import { NotFoundError, BusinessRuleError } from "../../core/errors/app-error";

/**
 * Caso de Uso: Cancelar um pedido de música (RN05).
 * Permite que o artista rejeite um pedido ou o sistema o cancele.
 */
export class CancelMusicRequestUseCase {
  constructor(
    private requestRepository: IMusicRequestRepository,
    private logger: ILogger
  ) {}

  async execute(requestId: string): Promise<void> {
    const request = await this.requestRepository.findById(requestId);

    if (!request) {
      throw new NotFoundError("Pedido não encontrado.");
    }

    if (request.status === 'played') {
      throw new BusinessRuleError("Não é possível cancelar um pedido que já foi tocado.");
    }

    // Muda o status para cancelado
    request.status = 'cancelled';

    // Se houver integração com gateway de pagamento no futuro, 
    // a lógica de estorno financeiro (Refund) seria disparada aqui.
    
    await this.requestRepository.save(request);
  }
}
