import { Artist } from "../../core/entities/artist.entity";
import { UnauthorizedError } from "../../core/errors/app-error";
import { IArtistRepository } from "../../core/ports/artist.repository";
import { IPasswordHasher } from "../../core/ports/password-hasher.port";
import { ILogger } from "../../core/ports/logger.port";
import { Email } from "../../core/value-objects/email.vo";

export interface AuthenticateArtistInput {
  email: string;
  passwordInPlainText: string;
}

/**
 * Caso de Uso: Autenticar um artista via E-mail e Senha.
 * Segue as diretrizes OWASP para validação de credenciais.
 */
export class AuthenticateArtistUseCase {
  constructor(
    private artistRepository: IArtistRepository,
    private passwordHasher: IPasswordHasher,
    private logger: ILogger
  ) {}

  async execute(input: AuthenticateArtistInput): Promise<Artist> {
    const emailVO = new Email(input.email);

    // 1. Buscar o artista
    const artist = await this.artistRepository.findByEmail(emailVO.getValue());
    
    // RN: Usamos uma mensagem genérica por segurança (não revelar se o email existe ou não)
    if (!artist) {
      this.logger.warn(`Tentativa de login falha (e-mail inexistente): ${input.email}`);
      throw new UnauthorizedError("E-mail ou senha inválidos.");
    }

    // 2. Verificar se o artista possui hash de senha cadastrado
    if (!artist.passwordHash) {
      this.logger.warn(`Tentativa de login falha (sem senha cadastrada): ${input.email}`)
      throw new UnauthorizedError("E-mail ou senha inválidos.")
    }

    // 3. Verificar senha
    const isPasswordValid = await this.passwordHasher.compare(
      input.passwordInPlainText,
      artist.passwordHash
    );

    if (!isPasswordValid) {
      this.logger.warn(`Tentativa de login falha (senha incorreta): ${input.email}`)
      throw new UnauthorizedError("E-mail ou senha inválidos.")
    }

    return artist;
  }
}
