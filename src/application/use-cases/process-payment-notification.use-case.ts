import type { IArtistRepository } from "../../core/ports/artist.repository";
import type { ILogger } from "../../core/ports/logger.port";
import type { IMusicRequestRepository } from "../../core/ports/music-request.repository";
import type { IPaymentCredentialsRepository } from "../../core/ports/payment-credentials.repository";
import type { IPaymentGatewayRegistry } from "../../core/ports/payment-gateway.port";
import type { PaymentGatewayName } from "../../core/value-objects/payment-account.vo";

export interface ProcessPaymentNotificationInput {
  /** ID do pagamento real no MP (vem em `data.id` do webhook). */
  paymentId: string;
  /** `user_id` do vendedor (collector) no MP — vem na raiz do payload do webhook. */
  sellerExternalAccountId: string;
  /** Gateway que originou a notificação. */
  gateway: PaymentGatewayName;
}

/**
 * Processa uma notificação de webhook de pagamento.
 *
 * Reconciliação Checkout Pro: ao criar a preference guardamos `preferenceId` em
 * `request.payment.paymentId`. O MP envia o `paymentId` real (criado quando o
 * cliente paga). Para mapear de volta, fetchamos o payment no MP usando o token
 * do vendedor (achado via `sellerExternalAccountId`) — o payment tem
 * `external_reference: <musicRequestId>` (setado por nós na preference).
 *
 * Idempotente: ignora se nada mudou (mesmo paymentId já gravado + mesmo status).
 */
export class ProcessPaymentNotificationUseCase {
  constructor(
    private readonly requestRepository: IMusicRequestRepository,
    private readonly artistRepository: IArtistRepository,
    private readonly credentialsRepository: IPaymentCredentialsRepository,
    private readonly registry: IPaymentGatewayRegistry,
    private readonly logger: ILogger
  ) {}

  async execute(input: ProcessPaymentNotificationInput): Promise<void> {
    const artist = await this.artistRepository.findByPaymentAccount(
      input.gateway,
      input.sellerExternalAccountId
    );
    if (!artist) {
      this.logger.info(
        `Webhook: artista n/d para gateway=${input.gateway} extAcc=${input.sellerExternalAccountId} (evento de outro contexto, ignorado)`
      );
      return;
    }

    const credentials = await this.credentialsRepository.findByArtistId(artist.id);
    if (!credentials) {
      this.logger.warn(`Webhook: artist=${artist.id} sem credenciais p/ buscar pagamento`);
      return;
    }

    const gateway = this.registry.get(input.gateway);
    const fetched = await gateway.fetchPaymentStatus({
      paymentId: input.paymentId,
      artistAccessToken: credentials.accessToken,
    });

    if (!fetched.externalReference) {
      this.logger.info(
        `Webhook: paymentId=${input.paymentId} sem external_reference (não foi criado por nós, ignorado)`
      );
      return;
    }

    const request = await this.requestRepository.findById(fetched.externalReference);
    if (!request) {
      this.logger.info(
        `Webhook: musicRequest=${fetched.externalReference} não encontrado (ignorado)`
      );
      return;
    }

    if (!request.payment) {
      this.logger.warn(`Webhook: request=${request.id} sem payment associado, ignorado`);
      return;
    }

    const needsIdUpgrade = request.payment.paymentId !== input.paymentId;
    const needsStatusUpdate = request.payment.status !== fetched.status;

    if (!needsIdUpgrade && !needsStatusUpdate) {
      this.logger.info(
        `Webhook: paymentId=${input.paymentId} já consolidado status=${fetched.status}, ignorado`
      );
      return;
    }

    if (needsIdUpgrade) {
      request.upgradePaymentId(input.paymentId);
    }
    if (needsStatusUpdate) {
      request.markPaymentStatus(fetched.status);
    }
    await this.requestRepository.save(request);

    this.logger.info(
      `Webhook processado: request=${request.id} payment=${input.paymentId} → ${fetched.status}`
    );
  }
}
