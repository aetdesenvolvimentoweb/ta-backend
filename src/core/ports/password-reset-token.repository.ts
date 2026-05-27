/**
 * Repositório de tokens de redefinição de senha.
 *
 * Persistimos apenas o hash SHA-256 do token bruto (entregue ao usuário por e-mail).
 * Isso garante que mesmo um vazamento do banco não permite tomar a conta de ninguém.
 */
export interface PasswordResetTokenRecord {
  id: string;
  artistId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface IPasswordResetTokenRepository {
  /** Salva um novo token (já com hash) ou marca um existente como usado. */
  save(record: PasswordResetTokenRecord): Promise<void>;

  /** Busca um token pelo hash. Retorna null se não existir. */
  findByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null>;

  /**
   * Invalida todos os tokens não-utilizados de um artista. Usado ao criar um novo
   * pedido de reset (single active token) e ao consumir um token (defense-in-depth).
   */
  invalidateAllForArtist(artistId: string): Promise<void>;
}
