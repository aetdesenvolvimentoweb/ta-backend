import { BusinessRuleError, NotFoundError, UnauthorizedError } from "../../core/errors/app-error";
import type { ILogger } from "../../core/ports/logger.port";
import type { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import type { IShowRepository } from "../../core/ports/show.repository";
import type { RefundTipPaymentUseCase } from "./tip-payment.use-case";

export interface FinishShowInput {
  showId: string;
  artistId: string;
}

/**
 * Caso de Uso: Encerrar um show manualmente.
 * Ao encerrar, os pedidos pendentes são cancelados.
 * Pedidos com gorjeta aprovada são estornados automaticamente (RN05/RN18).
 */
export class FinishShowUseCase {
  constructor(
    private showRepository: IShowRepository,
    private requestRepository: IMusicRequestRepository,
    private logger: ILogger,
    private refundTipPaymentUseCase?: RefundTipPaymentUseCase
  ) {}

  async execute(input: FinishShowInput): Promise<void> {
    const show = await this.showRepository.findById(input.showId);

    if (!show) {
      throw new NotFoundError("Show não encontrado.");
    }

    if (show.artistId !== input.artistId) {
      this.logger.warn(`Tentativa de finalizar show de outro artista`, {
        showId: input.showId,
        attemptedBy: input.artistId,
      });
      throw new UnauthorizedError("Você não tem permissão para finalizar este show.");
    }

    if (show.status !== "active") {
      throw new BusinessRuleError("Este show já não está mais ativo.");
    }

    // 1. Marcar show como finalizado
    show.finish();
    await this.showRepository.save(show);

    // 2. Cancelar pedidos pendentes — estornar gorjetas aprovadas (RN05/RN18)
    // Falhas individuais são logadas mas não abortam o finish: o show já foi finalizado
    // e os demais pedidos devem ser processados. Pedidos órfãos podem ser recuperados
    // por operação manual (futuro: endpoint admin de retry).
    const pendingRequests = await this.requestRepository.findByShowId(input.showId);
    let refundFailures = 0;
    for (const req of pendingRequests) {
      if (req.status !== "pending") continue;
      try {
        if (req.payment?.status === "approved" && this.refundTipPaymentUseCase) {
          await this.refundTipPaymentUseCase.execute({ musicRequestId: req.id });
        } else {
          req.cancel();
          await this.requestRepository.save(req);
        }
      } catch (err) {
        refundFailures++;
        this.logger.error("Falha ao processar pedido durante encerramento do show", err, {
          event: "show.finish.request_failed",
          showId: input.showId,
          requestId: req.id,
          paymentId: req.payment?.paymentId,
          paymentStatus: req.payment?.status,
        });
      }
    }

    this.logger.info(`Show ${input.showId} finalizado pelo artista ${input.artistId}`, {
      event: "show.finish.success",
      showId: input.showId,
      artistId: input.artistId,
      pendingCount: pendingRequests.length,
      refundFailures,
    });
  }
}
