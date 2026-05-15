import { eq } from "drizzle-orm";
import { db } from "../client";
import { artists } from "../schema";
import { isSupportedGateway } from "../../../core/value-objects/payment-account.vo";
import type {
  IPaymentCredentialsRepository,
  PaymentCredentials,
} from "../../../core/ports/payment-credentials.repository";
import type { ITokenCipher } from "../../security/token-cipher";

/**
 * Persiste tokens OAuth criptografados em repouso (RN17/22).
 * Reutiliza as colunas `payment_access_token_enc` / `payment_refresh_token_enc` da tabela `artists`.
 */
export class DrizzlePaymentCredentialsRepository implements IPaymentCredentialsRepository {
  constructor(private readonly cipher: ITokenCipher) {}

  async save(credentials: PaymentCredentials): Promise<void> {
    const accessEnc = await this.cipher.encrypt(credentials.accessToken);
    const refreshEnc = credentials.refreshToken
      ? await this.cipher.encrypt(credentials.refreshToken)
      : null;

    await db.update(artists).set({
      paymentGateway: credentials.gateway,
      paymentAccessTokenEnc: accessEnc,
      paymentRefreshTokenEnc: refreshEnc,
      paymentTokenExpiresAt: credentials.expiresAt,
    }).where(eq(artists.id, credentials.artistId));
  }

  async findByArtistId(artistId: string): Promise<PaymentCredentials | null> {
    const [row] = await db.select({
      gateway: artists.paymentGateway,
      accessEnc: artists.paymentAccessTokenEnc,
      refreshEnc: artists.paymentRefreshTokenEnc,
      expiresAt: artists.paymentTokenExpiresAt,
    }).from(artists).where(eq(artists.id, artistId));

    if (!row || !row.gateway || !row.accessEnc || !isSupportedGateway(row.gateway)) {
      return null;
    }

    const accessToken = await this.cipher.decrypt(row.accessEnc);
    const refreshToken = row.refreshEnc ? await this.cipher.decrypt(row.refreshEnc) : null;

    return {
      artistId,
      gateway: row.gateway,
      accessToken,
      refreshToken,
      expiresAt: row.expiresAt,
    };
  }

  async deleteByArtistId(artistId: string): Promise<void> {
    await db.update(artists).set({
      paymentAccessTokenEnc: null,
      paymentRefreshTokenEnc: null,
      paymentTokenExpiresAt: null,
    }).where(eq(artists.id, artistId));
  }
}
