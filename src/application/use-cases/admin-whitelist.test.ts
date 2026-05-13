import { expect, test, describe } from "bun:test";
import { ValidateAdminWhitelistUseCase } from "./admin-whitelist.use-case";

class MockWhitelistRepo {
  private allowed = ["admin@toqueaquela.com"];
  async isEmailAllowed(email: string) { return this.allowed.includes(email); }
  async addEmail(email: string) { this.allowed.push(email); }
}

const mockLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };

describe("Admin Whitelist Use Case", () => {
  test("deve permitir acesso para e-mail na whitelist", async () => {
    const repo = new MockWhitelistRepo();
    const useCase = new ValidateAdminWhitelistUseCase(repo as any, mockLogger as any);
    
    const result = await useCase.execute("admin@toqueaquela.com");
    expect(result).toBe(true);
  });

  test("deve negar acesso para e-mail fora da whitelist", async () => {
    const repo = new MockWhitelistRepo();
    const useCase = new ValidateAdminWhitelistUseCase(repo as any, mockLogger as any);
    
    expect(useCase.execute("hacker@gmail.com")).rejects.toThrow("Acesso negado");
  });
});
