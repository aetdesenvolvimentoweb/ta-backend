/**
 * Interface para abstração de hash de senhas (OWASP).
 * Permite que o domínio não dependa de uma biblioteca específica.
 */
export interface IPasswordHasher {
  /**
   * Transforma uma senha em texto puro em um hash seguro.
   */
  hash(password: string): Promise<string>;

  /**
   * Compara uma senha em texto puro com um hash.
   */
  compare(password: string, hash: string): Promise<boolean>;
}
