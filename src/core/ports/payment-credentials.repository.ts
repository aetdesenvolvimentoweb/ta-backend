import type { PaymentGatewayName } from "../value-objects/payment-account.vo";

/**
 * Credenciais OAuth de um gateway para um artista, em texto plano (já descriptografadas pelo repo).
 * Nunca é serializado para JSON nem entra no domínio — só transita entre Use Case e adapter.
 */
export interface PaymentCredentials {
  artistId: string;
  gateway: PaymentGatewayName;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

/**
 * Port isolado para tokens OAuth (RN17/22).
 *
 * Separado do `IArtistRepository` por dois motivos:
 *  1. Tokens são infra (criptografados em repouso). Nunca devem vazar para a entidade de domínio.
 *  2. A maioria dos use cases NÃO precisa ler tokens — só os de pagamento.
 *
 * O repositório implementa criptografia/descriptografia transparentemente.
 */
export interface IPaymentCredentialsRepository {
  /** Persiste/atualiza credenciais de um artista (encripta antes de gravar). */
  save(credentials: PaymentCredentials): Promise<void>;

  /** Busca credenciais descriptografadas. Retorna `null` se não houver conexão. */
  findByArtistId(artistId: string): Promise<PaymentCredentials | null>;

  /** Remove a vinculação (idempotente). */
  deleteByArtistId(artistId: string): Promise<void>;
}
