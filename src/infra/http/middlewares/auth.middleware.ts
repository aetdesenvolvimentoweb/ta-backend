import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { UnauthorizedError } from "../../../core/errors/app-error";

/**
 * Middleware de autenticação que valida o token JWT.
 * Fornece a função 'isAuthenticated' e o objeto 'artist' para as rotas protegidas.
 */
export const authMiddleware = new Elysia()
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET!
    })
  )
  .derive({ as: 'global' }, ({ jwt, headers: { authorization } }) => ({
    getArtistId: async () => {
      if (!authorization) {
        throw new UnauthorizedError("Token não fornecido.");
      }

      const token = authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : authorization;

      const payload = await jwt.verify(token);

      if (!payload) {
        throw new UnauthorizedError("Token inválido ou expirado.");
      }

      return payload.sub as string;
    }
  }));
