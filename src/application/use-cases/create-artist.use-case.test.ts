import { expect, test, describe, spyOn } from "bun:test";
import { CreateArtistUseCase } from "./create-artist.use-case";
import { Artist } from "../../core/entities/artist.entity";
import { BusinessRuleError } from "../../core/errors/app-error";

/**
 * Mock simples para o Logger.
 */
const mockLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {}
};

/**
 * Mock simples em memória para o repositório de artistas.
 */
class InMemoryArtistRepository {
  private artists: Artist[] = [];
  
  async save(artist: Artist): Promise<void> {
    this.artists.push(artist);
  }

  async findByEmail(email: string): Promise<Artist | null> {
    return this.artists.find(a => a.email.getValue() === email) || null;
  }

  async findById(id: string): Promise<Artist | null> {
    return this.artists.find(a => a.id === id) || null;
  }

  async delete(id: string): Promise<void> {
    this.artists = this.artists.filter(a => a.id !== id);
  }
}

describe("CreateArtist Use Case", () => {
  test("deve criar um artista com sucesso", async () => {
    const repo = new InMemoryArtistRepository();
    const useCase = new CreateArtistUseCase(repo, mockLogger as any);

    const input = {
      name: "João do Violão",
      email: "joao@musica.com",
      socials: { instagram: "@joaoviolao" }
    };

    const artist = await useCase.execute(input);

    expect(artist.id).toBeDefined();
    expect(artist.name).toBe(input.name);
    expect(artist.email.getValue()).toBe(input.email);
    
    // Verificar se foi salvo no repo
    const saved = await repo.findByEmail(input.email);
    expect(saved).not.toBeNull();
  });

  test("deve lançar erro se o e-mail já existir", async () => {
    const repo = new InMemoryArtistRepository();
    const useCase = new CreateArtistUseCase(repo, mockLogger as any);

    const input = {
      name: "João",
      email: "duplicado@musica.com"
    };

    await useCase.execute(input); // Primeiro cadastro
    
    // Segunda tentativa com mesmo e-mail
    try {
      await useCase.execute(input);
      expect(true).toBe(false); // Não deve chegar aqui
    } catch (error: any) {
      expect(error).toBeInstanceOf(BusinessRuleError);
      expect(error.message).toContain("já está em uso");
    }
  });
});
