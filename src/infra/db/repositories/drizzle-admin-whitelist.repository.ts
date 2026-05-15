import type { IAdminWhitelistRepository } from "../../../application/use-cases/admin-whitelist.use-case";

/**
 * Implementação atual da whitelist baseada em variável de ambiente
 * (ADMIN_WHITELIST = lista comma-separated de e-mails). Mantém o contrato do
 * IAdminWhitelistRepository para permitir migração futura para tabela Postgres
 * sem mudanças no use case (RN12).
 *
 * Decisão: até o RN12 final (OAuth Google + gestão de admins via UI), env é
 * suficiente, simples e auditável via deploy.
 */
export class DrizzleAdminWhitelistRepository implements IAdminWhitelistRepository {
  private readonly whitelist: Set<string>;

  constructor(initial: readonly string[]) {
    this.whitelist = new Set(initial.map(e => e.trim().toLowerCase()).filter(Boolean));
  }

  async isEmailAllowed(email: string): Promise<boolean> {
    return this.whitelist.has(email.trim().toLowerCase());
  }

  async addEmail(email: string): Promise<void> {
    this.whitelist.add(email.trim().toLowerCase());
  }
}
