import { jwt } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import type { AuthenticateArtistUseCase } from "../../../application/use-cases/authenticate-artist.use-case";
import type { CreateArtistUseCase } from "../../../application/use-cases/create-artist.use-case";
import type { RequestPasswordResetUseCase } from "../../../application/use-cases/request-password-reset.use-case";
import type { ResetPasswordUseCase } from "../../../application/use-cases/reset-password.use-case";
import type {
  GetArtistProfileUseCase,
  UpdateArtistProfileUseCase,
} from "../../../application/use-cases/update-artist-profile.use-case";
import { env } from "../../config/env";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  extractClientIp,
  recordLoginAttempt,
  resetLoginAttempts,
} from "../middlewares/login-rate-limit";

export const artistController = (
  createArtistUseCase: CreateArtistUseCase,
  authenticateArtistUseCase: AuthenticateArtistUseCase,
  requestPasswordResetUseCase: RequestPasswordResetUseCase,
  resetPasswordUseCase: ResetPasswordUseCase
) =>
  new Elysia({ prefix: "/artists" })
    .use(
      jwt({
        name: "jwt",
        secret: env.JWT_SECRET,
        exp: env.JWT_EXPIRES_IN,
      })
    )
    /**
     * Cadastro de novo artista.
     *
     * Não retorna JWT: o usuário deve passar pela tela de login após criar a conta.
     * Isso evita que cadastros feitos em dispositivos compartilhados deixem sessão ativa.
     */
    .post(
      "/",
      async ({ body, set }) => {
        const artist = await createArtistUseCase.execute(body);
        set.status = 201;
        return {
          artist: {
            id: artist.id,
            name: artist.name,
            email: artist.email.getValue(),
            socials: artist.socials,
            isPremium: artist.isPremium,
          },
        };
      },
      {
        body: t.Object({
          name: t.String({ minLength: 2 }),
          email: t.String({ format: "email" }),
          password: t.String({ minLength: 12 }),
          socials: t.Optional(t.Record(t.String(), t.String())),
        }),
        detail: {
          summary: "Cadastrar um novo artista",
          tags: ["Artist"],
        },
      }
    )

    /**
     * Login do artista
     */
    .post(
      "/login",
      async ({ body, jwt, request, set }) => {
        const ip = extractClientIp(request.headers);

        const limit = recordLoginAttempt(ip);
        if (!limit.allowed) {
          set.status = 429;
          set.headers["retry-after"] = String(limit.retryAfterSeconds);
          return {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Muitas tentativas de login. Tente novamente em alguns minutos.",
          };
        }

        const artist = await authenticateArtistUseCase.execute({
          email: body.email,
          passwordInPlainText: body.password,
        });

        resetLoginAttempts(ip);

        const token = await jwt.sign({
          sub: artist.id,
          email: artist.email.getValue(),
        });

        return {
          message: "Login realizado com sucesso",
          artist: {
            id: artist.id,
            name: artist.name,
            email: artist.email.getValue(),
          },
          token,
        };
      },
      {
        body: t.Object({
          email: t.String({ format: "email" }),
          password: t.String(),
        }),
        detail: {
          summary: "Autenticar um artista",
          tags: ["Artist"],
        },
      }
    )

    /**
     * Solicita o envio de e-mail de redefinição de senha.
     * Sempre retorna 204 para não vazar quais e-mails existem na base.
     */
    .post(
      "/password-reset/request",
      async ({ body, set }) => {
        await requestPasswordResetUseCase.execute({ email: body.email });
        set.status = 204;
        return null;
      },
      {
        body: t.Object({
          email: t.String({ format: "email" }),
        }),
        detail: {
          summary: "Solicitar redefinição de senha (envio de e-mail)",
          tags: ["Artist"],
        },
      }
    )

    /**
     * Confirma redefinição de senha usando o token enviado por e-mail.
     */
    .post(
      "/password-reset/confirm",
      async ({ body, set }) => {
        await resetPasswordUseCase.execute({
          token: body.token,
          newPassword: body.newPassword,
        });
        set.status = 204;
        return null;
      },
      {
        body: t.Object({
          token: t.String({ minLength: 32 }),
          newPassword: t.String({ minLength: 12 }),
        }),
        detail: {
          summary: "Confirmar redefinição de senha",
          tags: ["Artist"],
        },
      }
    );

export const artistProfileController = (
  getProfileUseCase: GetArtistProfileUseCase,
  updateProfileUseCase: UpdateArtistProfileUseCase
) =>
  new Elysia({ prefix: "/artists" })
    .use(authMiddleware)

    .get(
      "/me",
      async ({ getArtistId }) => {
        const artistId = await getArtistId();
        return getProfileUseCase.execute(artistId);
      },
      {
        detail: {
          summary: "Obter perfil do artista autenticado",
          tags: ["Artist"],
          security: [{ bearerAuth: [] }],
        },
      }
    )

    .patch(
      "/me",
      async ({ body, getArtistId }) => {
        const artistId = await getArtistId();
        return updateProfileUseCase.execute({ artistId, ...body });
      },
      {
        body: t.Object({
          name: t.Optional(t.String({ minLength: 2 })),
          socials: t.Optional(t.Record(t.String(), t.String())),
        }),
        detail: {
          summary: "Atualizar nome e redes sociais do artista",
          tags: ["Artist"],
          security: [{ bearerAuth: [] }],
        },
      }
    );
