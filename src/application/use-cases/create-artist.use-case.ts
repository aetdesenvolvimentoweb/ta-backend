import { Artist } from "../../core/entities/artist.entity";
import { BusinessRuleError } from "../../core/errors/app-error";
import type { IArtistRepository } from "../../core/ports/artist.repository";
import type { ILogger } from "../../core/ports/logger.port";
import type { IPasswordHasher } from "../../core/ports/password-hasher.port";
import { Email } from "../../core/value-objects/email.vo";

/**
 * DTO (Data Transfer Object) para entrada do caso de uso.
 */
export interface CreateArtistInput {
  name: string;
  email: string;
  password?: string;
  socials?: Record<string, string>;
}

/**
 * Caso de Uso: Cadastro de um novo artista.
 * @class CreateArtistUseCase
 */
export class CreateArtistUseCase {
  constructor(
    private artistRepository: IArtistRepository,
    private passwordHasher: IPasswordHasher,
    private logger: ILogger
  ) {}

  /**
   * Executa a lógica de criação de um artista.
   * @throws BusinessRuleError se o e-mail já estiver cadastrado.
   */
  async execute(input: CreateArtistInput): Promise<Artist> {
    const emailVO = new Email(input.email);

    // 1. Verificar se o e-mail já existe (Regra de Negócio)
    const existingArtist = await this.artistRepository.findByEmail(emailVO.getValue());
    if (existingArtist) {
      throw new BusinessRuleError("Este e-mail já está em uso por outro artista.");
    }

    // 2. Hashear senha se fornecida
    let passwordHash: string | undefined;
    if (input.password) {
      passwordHash = await this.passwordHasher.hash(input.password);
    }

    // 3. Criar a entidade (O ID deve ser gerado, aqui usaremos o crypto do Bun/Node)
    const id = crypto.randomUUID();
    const artist = new Artist(
      id,
      input.name,
      emailVO,
      passwordHash,
      input.socials ?? {},
      false // Inicia como não-premium
    );

    // 4. Persistir
    await this.artistRepository.save(artist);

    this.logger.info(`Novo artista cadastrado: ${artist.name} (${artist.id})`);

    return artist;
  }
}
