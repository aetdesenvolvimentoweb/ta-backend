import { IPasswordHasher } from "../../core/ports/password-hasher.port";

/**
 * Implementação do IPasswordHasher utilizando as funções nativas do Bun.
 * Utiliza o algoritmo bcrypt por padrão.
 */
export class BunPasswordHasher implements IPasswordHasher {
  async hash(password: string): Promise<string> {
    return await Bun.password.hash(password);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return await Bun.password.verify(password, hash);
  }
}
