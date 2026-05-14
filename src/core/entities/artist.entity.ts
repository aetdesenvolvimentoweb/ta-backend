import { Email } from "../value-objects/email.vo";

/**
 * Representa um artista na plataforma Toque Aquela.
 * @class Artist
 */
export class Artist {
  /**
   * @param {string} id - Identificador único do artista (UUID).
   * @param {string} name - Nome artístico ou nome do usuário.
   * @param {Email} email - E-mail de contato e login (Value Object).
   * @param {Record<string, string>} socials - Redes sociais (ex: { instagram: '@perfil' }).
   * @param {boolean} isPremium - Define se o artista possui assinatura ativa (reduz comissão).
   */
  constructor(
    public readonly id: string,
    public name: string,
    public readonly email: Email,
    public passwordHash?: string,
    public socials: Record<string, string> = {},
    public isPremium: boolean = false
  ) {}

  /**
   * Atualiza as redes sociais do artista.
   * @param {Record<string, string>} newSocials - Novas redes sociais para mesclar.
   */
  updateSocials(newSocials: Record<string, string>): void {
    this.socials = { ...this.socials, ...newSocials };
  }

  /**
   * Ativa/Desativa o status premium do artista.
   * @param {boolean} status - Novo status premium.
   */
  setPremiumStatus(status: boolean): void {
    this.isPremium = status;
  }
}
