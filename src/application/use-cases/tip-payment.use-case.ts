import { BusinessRuleError, NotFoundError } from "../../core/errors/app-error";
import type { IArtistRepository } from "../../core/ports/artist.repository";
import type { ILogger } from "../../core/ports/logger.port";
import type { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import type { IPaymentCredentialsRepository } from "../../core/ports/payment-credentials.repository";
import type {
  IPaymentGatewayRegistry,
  TipPaymentStatus,
} from "../../core/ports/payment-gateway.port";
import type { IShowRepository } from "../../core/ports/show.repository";

export interface CreateTipPaymentInput {
  musicRequestId: string;
}

export interface CreateTipPaymentOutput {
  paymentId: string;
  status: TipPaymentStatus;
  checkoutUrl?: string;
}

/**
 * Cria um pagamento PIX com split nativo 85/15 (RN16) para um pedido de música com gorjeta.
 * Chamado logo após RequestMusicUseCase quando tipAmountInCents > 0.
 */
export class CreateTipPaymentUseCase {
  constructor(
    private readonly requestRepository: IMusicRequestRepository,
    private readonly showRepository: IShowRepository,
    private readonly artistRepository: IArtistRepository,
    private readonly credentialsRepository: IPaymentCredentialsRepository,
    private readonly registry: IPaymentGatewayRegistry,
    private readonly logger: ILogger
  ) {}

  async execute(input: CreateTipPaymentInput): Promise<CreateTipPaymentOutput> {
    const request = await this.requestRepository.findById(input.musicRequestId);
    if (!request) throw new NotFoundError("Pedido não encontrado.");

    // Idempotência: pagamento já foi criado anteriormente
    if (request.payment !== null) {
      return {
        paymentId: request.payment.paymentId,
        status: request.payment.status,
      };
    }

    const show = await this.showRepository.findById(request.showId);
    if (!show) throw new NotFoundError("Show do pedido não encontrado.");

    const artist = await this.artistRepository.findById(show.artistId);
    if (!artist || !artist.canReceiveTips()) {
      throw new BusinessRuleError("Artista sem conta de pagamento conectada (RN15).");
    }

    const credentials = await this.credentialsRepository.findByArtistId(show.artistId);
    if (!credentials) {
      throw new BusinessRuleError("Credenciais de pagamento não encontradas para o artista.");
    }

    const gateway = this.registry.get(artist.paymentAccount!.gateway);
    const result = await gateway.createTipPayment({
      artistExternalAccountId: artist.paymentAccount!.externalAccountId,
      artistAccessToken: credentials.accessToken,
      amountInCents: request.tip.amountInCents,
      platformFeePercent: 15,
      idempotencyKey: request.id,
      payerName: request.customerName,
      description: "Gorjeta - Toque Aquela",
    });

    request.attachPayment({
      gateway: artist.paymentAccount!.gateway,
      paymentId: result.paymentId,
      status: result.status,
    });
    await this.requestRepository.save(request);

    this.logger.info(
      `Pagamento PIX criado: request=${request.id} payment=${result.paymentId} status=${result.status}`
    );

    return {
      paymentId: result.paymentId,
      status: result.status,
      checkoutUrl: result.checkoutUrl,
    };
  }
}

export interface RefundTipPaymentInput {
  musicRequestId: string;
}

/**
 * Estorna o pagamento aprovado de um pedido e marca o pedido como reembolsado (RN18).
 * Se não houver pagamento aprovado, apenas cancela o pedido.
 */
export class RefundTipPaymentUseCase {
  constructor(
    private readonly requestRepository: IMusicRequestRepository,
    private readonly showRepository: IShowRepository,
    private readonly credentialsRepository: IPaymentCredentialsRepository,
    private readonly registry: IPaymentGatewayRegistry,
    private readonly logger: ILogger
  ) {}

  async execute(input: RefundTipPaymentInput): Promise<void> {
    const request = await this.requestRepository.findById(input.musicRequestId);
    if (!request) throw new NotFoundError("Pedido não encontrado.");

    if (!request.payment || request.payment.status !== "approved") {
      // Sem pagamento aprovado — cancela diretamente
      request.cancel();
      await this.requestRepository.save(request);
      return;
    }

    const show = await this.showRepository.findById(request.showId);
    if (!show) throw new NotFoundError("Show do pedido não encontrado.");

    const credentials = await this.credentialsRepository.findByArtistId(show.artistId);
    if (!credentials) {
      // Sem credenciais — cancela sem estorno e loga o problema
      this.logger.warn(`Estorno sem credenciais: artist=${show.artistId} request=${request.id}`);
      request.cancel();
      await this.requestRepository.save(request);
      return;
    }

    const gateway = this.registry.get(request.payment.gateway);
    await gateway.refundTipPayment({
      paymentId: request.payment.paymentId,
      artistAccessToken: credentials.accessToken,
    });

    request.markPaymentStatus("refunded");
    await this.requestRepository.save(request);

    this.logger.info(
      `Gorjeta estornada: request=${request.id} payment=${request.payment.paymentId}`
    );
  }
}
