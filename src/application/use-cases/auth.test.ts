import { expect, test, describe } from "bun:test";
import { AuthenticateArtistUseCase } from "./authenticate-artist.use-case";
import { Artist } from "../../core/entities/artist.entity";
import { Email } from "../../core/value-objects/email.vo";
import { IPasswordHasher } from "../../core/ports/password-hasher.port";

class MockArtistRepo {
  async findByEmail(email: string) {
    if (email === "artista@show.com") {
      return new Artist("id-1", "João", new Email(email), "hash_correta");
    }
    return null;
  }
  async save() {}
  async findById() { return null; }
  async delete() {}
}

class MockHasher implements IPasswordHasher {
  async hash(p: string) { return "hash_" + p; }
  async compare(p: string, h: string) { return h === "hash_correta"; }
}

const mockLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };

describe("AuthenticateArtist Use Case", () => {
  test("deve autenticar com sucesso se as credenciais estiverem corretas", async () => {
    const repo = new MockArtistRepo();
    const hasher = new MockHasher();
    const useCase = new AuthenticateArtistUseCase(repo as any, hasher, mockLogger as any);

    // Mockando o comportamento do compare para este teste
    hasher.compare = async () => true;

    const artist = await useCase.execute({
      email: "artista@show.com",
      passwordInPlainText: "senha123"
    });

    expect(artist.name).toBe("João");
  });

  test("deve falhar se o e-mail não existir", async () => {
    const repo = new MockArtistRepo();
    const hasher = new MockHasher();
    const useCase = new AuthenticateArtistUseCase(repo as any, hasher, mockLogger as any);

    await expect(useCase.execute({
      email: "inexistente@show.com",
      passwordInPlainText: "senha123"
    })).rejects.toThrow("E-mail ou senha inválidos");
  });

  test("deve falhar se a senha estiver incorreta", async () => {
    const repo = new MockArtistRepo();
    const hasher = new MockHasher();
    const useCase = new AuthenticateArtistUseCase(repo as any, hasher, mockLogger as any);

    // Mockando senha incorreta
    hasher.compare = async () => false;

    await expect(useCase.execute({
      email: "artista@show.com",
      passwordInPlainText: "errada"
    })).rejects.toThrow("E-mail ou senha inválidos");
  });
});
