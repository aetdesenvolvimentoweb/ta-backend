import { jwt } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import type { AuthenticateArtistUseCase } from "../../../application/use-cases/authenticate-artist.use-case";
import type { CreateArtistUseCase } from "../../../application/use-cases/create-artist.use-case";
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
  authenticateArtistUseCase: AuthenticateArtistUseCase
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
     * Cadastro de novo artista
     */
    .post(
      "/",
      async ({ body, jwt }) => {
        const artist = await createArtistUseCase.execute(body);

        const token = await jwt.sign({
          sub: artist.id,
          email: artist.email.getValue(),
        });

        return {
          artist: {
            id: artist.id,
            name: artist.name,
            email: artist.email.getValue(),
            socials: artist.socials,
            isPremium: artist.isPremium,
          },
          token,
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
