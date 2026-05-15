import type { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import type { IShowRepository } from "../../core/ports/show.repository";
import type { IPaymentCredentialsRepository } from "../../core/ports/payment-credentials.repository";
import type { IPaymentGatewayRegistry } from "../../core/ports/payment-gateway.port";
import type { ILogger } from "../../core/ports/logger.port";

export interface ProcessPaymentNotificationInput {
  paymentId: string;
}

/**
 * Processa uma notificação de webhook de pagamento.
 *
 * Busca o status atual do pagamento no gateway e atualiza o MusicRequest correspondente.
 * Idempotente: ignora se o status já for o mesmo.
 */
export class ProcessPaymentNotificationUseCase {
  constructor(
    private readonly requestRepository: IMusicRequestRepository,
    private readonly showRepository: IShowRepository,
    private readonly credentialsRepository: IPaymentCredentialsRepository,
    private readonly registry: IPaymentGatewayRegistry,
    private readonly logger: ILogger,
  ) {}

  async execute(input: ProcessPaymentNotificationInput): Promise<void> {
    const request = await this.requestRepository.findByPaymentId(input.paymentId);
    if (!request) {
      this.logger.info(`Webhook: paymentId=${input.paymentId} não encontrado (evento de outro contexto, ignorado)`);
      return;
    }

    if (!request.payment) {
      this.logger.warn(`Webhook: request=${request.id} sem payment associado, ignorado`);
      return;
    }

    const show = await this.showRepository.findById(request.showId);
    if (!show) {
      this.logger.warn(`Webhook: show=${request.showId} não encontrado para request=${request.id}`);
      return;
    }

    const credentials = await this.credentialsRepository.findByArtistId(show.artistId);
    const gateway = this.registry.get(request.payment.gateway);

    const newStatus = await gateway.fetchPaymentStatus({
      paymentId: input.paymentId,
      artistAccessToken: credentials?.accessToken,
    });

    if (request.payment.status === newStatus) {
      this.logger.info(`Webhook: paymentId=${input.paymentId} já no status=${newStatus}, ignorado`);
      return;
    }

    request.markPaymentStatus(newStatus);
    await this.requestRepository.save(request);

    this.logger.info(`Webhook processado: paymentId=${input.paymentId} → ${newStatus}`);
  }
}
