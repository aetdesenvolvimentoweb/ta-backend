/**
 * Interface para gerenciar a lista de e-mails autorizados (Whitelist) de administradores.
 */
export interface IAdminWhitelistRepository {
  /**
   * Verifica se um e-mail está na lista de administradores autorizados.
   */
  isEmailAllowed(email: string): Promise<boolean>;
  
  /**
   * Adiciona um e-mail à whitelist (Apenas outro admin pode fazer isso).
   */
  addEmail(email: string): Promise<void>;
}

/**
 * Caso de Uso: Validar se um usuário pode acessar o painel administrativo.
 */
export class ValidateAdminWhitelistUseCase {
  constructor(private whitelistRepository: IAdminWhitelistRepository) {}

  async execute(email: string): Promise<boolean> {
    const isAllowed = await this.whitelistRepository.isEmailAllowed(email);
    
    if (!isAllowed) {
      throw new Error("Acesso negado. Este e-mail não está na lista de administradores autorizados.");
    }

    return true;
  }
}
