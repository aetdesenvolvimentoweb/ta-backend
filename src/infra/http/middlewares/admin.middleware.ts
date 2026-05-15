import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { UnauthorizedError } from "../../../core/errors/app-error";
import type { ValidateAdminWhitelistUseCase } from "../../../application/use-cases/admin-whitelist.use-case";

/**
 * Middleware admin: exige JWT válido E e-mail do payload presente na whitelist (RN12).
 * Hoje a whitelist é alimentada via env var ADMIN_WHITELIST; quando RN12
 * completo (OAuth Google), substituir só o repositório.
 */
export const adminMiddleware = (validateWhitelist: ValidateAdminWhitelistUseCase) =>
  new Elysia({ name: 'admin-middleware' })
    .use(jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET!,
      exp: process.env.JWT_EXPIRES_IN ?? '7d'
    }))
    .derive({ as: 'scoped' }, ({ jwt, headers: { authorization } }) => ({
      ensureAdmin: async (): Promise<{ email: string; sub: string }> => {
        if (!authorization) {
          throw new UnauthorizedError("Token não fornecido.");
        }
        const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : authorization;
        const payload = await jwt.verify(token);
        if (!payload || typeof payload === 'boolean') {
          throw new UnauthorizedError("Token inválido ou expirado.");
        }
        const email = String(payload.email ?? '');
        const sub = String(payload.sub ?? '');
        if (!email) {
          throw new UnauthorizedError("Token sem identificação de e-mail.");
        }
        await validateWhitelist.execute(email);
        return { email, sub };
      }
    }));
