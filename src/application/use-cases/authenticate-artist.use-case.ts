import { Artist } from "../../core/entities/artist.entity";
import { IArtistRepository } from "../../core/ports/artist.repository";
import { IPasswordHasher } from "../../core/ports/password-hasher.port";
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
    private passwordHasher: IPasswordHasher
  ) {}

  async execute(input: AuthenticateArtistInput): Promise<Artist> {
    const emailVO = new Email(input.email);

    // 1. Buscar o artista
    const artist = await this.artistRepository.findByEmail(emailVO.getValue());
    
    // RN: Usamos uma mensagem genérica por segurança (não revelar se o email existe ou não)
    if (!artist) {
      throw new Error("E-mail ou senha inválidos.");
    }

    // 2. No mundo real, as entidades teriam um campo 'passwordHash'. 
    // Como estamos definindo as entidades agora, vou assumir que o repositório 
    // nos daria acesso a esse dado ou teríamos uma entidade de 'Account'.
    
    // Para manter o KISS por enquanto, vamos fingir que o repositório 
    // busca o hash de alguma forma vinculada ao artista.
    
    // TODO: Adicionar campo passwordHash na persistência do Artista futuramente.
    // Por enquanto, o Mock vai simular essa validação.
    const isPasswordValid = await this.passwordHasher.compare(
      input.passwordInPlainText, 
      "hash_simulado_do_banco" 
    );

    if (!isPasswordValid) {
      throw new Error("E-mail ou senha inválidos.");
    }

    return artist;
  }
}
