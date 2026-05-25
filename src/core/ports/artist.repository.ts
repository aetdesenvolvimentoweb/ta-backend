import type { Artist } from "../entities/artist.entity";
import type { PaymentGatewayName } from "../value-objects/payment-account.vo";

/**
 * Interface de Repositório para a entidade Artist.
 * Define o contrato de persistência para artistas.
 */
export interface IArtistRepository {
  /**
   * Salva um novo artista ou atualiza um existente.
   */
  save(artist: Artist): Promise<void>;

  /**
   * Busca um artista pelo ID único.
   */
  findById(id: string): Promise<Artist | null>;

  /**
   * Busca um artista pelo e-mail.
   */
  findByEmail(email: string): Promise<Artist | null>;

  /**
   * Busca um artista pela conta externa de pagamento (gateway + externalAccountId).
   * Usado para reconciliar webhooks: MP envia o `user_id` do vendedor no payload,
   * e precisamos descobrir qual artista da nossa base corresponde.
   */
  findByPaymentAccount(
    gateway: PaymentGatewayName,
    externalAccountId: string
  ): Promise<Artist | null>;

  /**
   * Remove um artista do sistema.
   */
  delete(id: string): Promise<void>;
}
