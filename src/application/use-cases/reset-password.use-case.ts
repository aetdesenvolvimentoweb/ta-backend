import { BusinessRuleError } from "../../core/errors/app-error";
import type { IArtistRepository } from "../../core/ports/artist.repository";
import type { ILogger } from "../../core/ports/logger.port";
import type { IPasswordHasher } from "../../core/ports/password-hasher.port";
import type { IPasswordResetTokenRepository } from "../../core/ports/password-reset-token.repository";

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface ResetPasswordDeps {
  artistRepository: IArtistRepository;
  tokenRepository: IPasswordResetTokenRepository;
  passwordHasher: IPasswordHasher;
  logger: ILogger;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

const MIN_PASSWORD_LENGTH = 12;

export class ResetPasswordUseCase {
  constructor(private deps: ResetPasswordDeps) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    const { artistRepository, tokenRepository, passwordHasher, logger } = this.deps;

    if (!input.token || typeof input.token !== "string") {
      throw new BusinessRuleError("Token inválido.");
    }
    if (!input.newPassword || input.newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BusinessRuleError(
        `A nova senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`
      );
    }

    const tokenHash = await sha256Hex(input.token);
    const record = await tokenRepository.findByHash(tokenHash);

    if (!record) {
      throw new BusinessRuleError("Token inválido ou expirado.");
    }
    if (record.usedAt !== null) {
      throw new BusinessRuleError("Token inválido ou expirado.");
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BusinessRuleError("Token inválido ou expirado.");
    }

    const artist = await artistRepository.findById(record.artistId);
    if (!artist) {
      // Caso de borda: artista deletado entre o pedido e o consumo do token.
      throw new BusinessRuleError("Token inválido ou expirado.");
    }

    artist.passwordHash = await passwordHasher.hash(input.newPassword);
    await artistRepository.save(artist);

    // Marca o token como usado e invalida quaisquer outros não-usados (defense-in-depth).
    await tokenRepository.save({ ...record, usedAt: new Date() });
    await tokenRepository.invalidateAllForArtist(artist.id);

    logger.info("Senha redefinida com sucesso", {
      event: "password_reset.completed",
      artistId: artist.id,
    });
  }
}
