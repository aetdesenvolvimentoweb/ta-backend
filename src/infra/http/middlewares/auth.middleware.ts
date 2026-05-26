import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";
import { UnauthorizedError } from "../../../core/errors/app-error";
import { env } from "../../config/env";

/**
 * Middleware de autenticação que valida o token JWT.
 * Fornece a função 'isAuthenticated' e o objeto 'artist' para as rotas protegidas.
 */
export const authMiddleware = new Elysia()
  .use(
    jwt({
      name: "jwt",
      secret: env.JWT_SECRET,
      exp: env.JWT_EXPIRES_IN,
    })
  )
  .derive({ as: "global" }, ({ jwt, headers: { authorization } }) => ({
    getArtistId: async () => {
      if (!authorization) {
        throw new UnauthorizedError("Token não fornecido.");
      }

      const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : authorization;

      const payload = await jwt.verify(token);

      if (!payload) {
        throw new UnauthorizedError("Token inválido ou expirado.");
      }

      return payload.sub as string;
    },
  }));
