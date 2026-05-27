import type { IArtistRepository } from "../../core/ports/artist.repository";
import type { IEmailService } from "../../core/ports/email-service.port";
import type { ILogger } from "../../core/ports/logger.port";
import type { IPasswordResetTokenRepository } from "../../core/ports/password-reset-token.repository";
import { Email } from "../../core/value-objects/email.vo";

export interface RequestPasswordResetInput {
  email: string;
}

export interface RequestPasswordResetDeps {
  artistRepository: IArtistRepository;
  tokenRepository: IPasswordResetTokenRepository;
  emailService: IEmailService | null;
  logger: ILogger;
  /** Base do frontend para montar o link (ex: `https://app.toqueaquela.com`). */
  frontendBaseUrl: string;
  /** TTL do token em minutos. */
  tokenTtlMin: number;
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Caso de uso: solicitar redefinição de senha.
 *
 * Comportamento crítico (anti-enumeração):
 *  - Sempre retorna sucesso, mesmo se o e-mail não existir na base.
 *  - O e-mail só é enviado se houver artista correspondente.
 *  - Tokens anteriores não-utilizados são invalidados (single active token).
 *
 * Em dev/test, se `emailService` for `null`, o link é apenas logado em INFO —
 * permite testar o fluxo sem precisar de API key do Resend.
 */
export class RequestPasswordResetUseCase {
  constructor(private deps: RequestPasswordResetDeps) {}

  async execute(input: RequestPasswordResetInput): Promise<void> {
    const {
      artistRepository,
      tokenRepository,
      emailService,
      logger,
      frontendBaseUrl,
      tokenTtlMin,
    } = this.deps;

    let emailValue: string;
    try {
      emailValue = new Email(input.email).getValue();
    } catch {
      // E-mail malformado: retornamos sucesso silenciosamente para não vazar nada.
      logger.warn(`Pedido de reset com e-mail inválido: ${input.email}`);
      return;
    }

    const artist = await artistRepository.findByEmail(emailValue);
    if (!artist) {
      logger.info(`Pedido de reset para e-mail não cadastrado: ${emailValue}`);
      return;
    }

    // Invalida tokens não-utilizados anteriores
    await tokenRepository.invalidateAllForArtist(artist.id);

    const rawToken = generateToken();
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + tokenTtlMin * 60 * 1000);

    await tokenRepository.save({
      id: crypto.randomUUID(),
      artistId: artist.id,
      tokenHash,
      expiresAt,
      usedAt: null,
    });

    const link = `${frontendBaseUrl.replace(/\/$/, "")}/artista/redefinir-senha?token=${rawToken}`;
    const subject = "Redefinir sua senha — Toque Aquela";
    const text =
      `Olá, ${artist.name}!\n\n` +
      `Recebemos um pedido para redefinir a senha da sua conta no Toque Aquela.\n\n` +
      `Clique no link abaixo para criar uma nova senha (válido por ${tokenTtlMin} minutos):\n\n` +
      `${link}\n\n` +
      `Se você não solicitou essa redefinição, pode ignorar este e-mail — sua senha continua a mesma.\n\n` +
      `— Equipe Toque Aquela`;
    const html =
      `<p>Olá, <strong>${artist.name}</strong>!</p>` +
      `<p>Recebemos um pedido para redefinir a senha da sua conta no Toque Aquela.</p>` +
      `<p><a href="${link}">Clique aqui para criar uma nova senha</a> (válido por ${tokenTtlMin} minutos).</p>` +
      `<p style="color:#666;font-size:12px">Se você não solicitou essa redefinição, pode ignorar este e-mail — sua senha continua a mesma.</p>` +
      `<p>— Equipe Toque Aquela</p>`;

    if (emailService) {
      await emailService.send({ to: emailValue, subject, text, html });
      logger.info("E-mail de reset de senha enviado", {
        event: "password_reset.email_sent",
        artistId: artist.id,
      });
    } else {
      // Modo dev/test sem provedor configurado: loga link para inspeção manual.
      logger.info("Reset de senha solicitado (envio de e-mail desativado)", {
        event: "password_reset.email_disabled",
        artistId: artist.id,
        link,
      });
    }
  }
}
