import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";
import type { ValidateAdminWhitelistUseCase } from "../../../application/use-cases/admin-whitelist.use-case";
import { UnauthorizedError } from "../../../core/errors/app-error";
import type { ILogger } from "../../../core/ports/logger.port";
import { extractClientIp } from "./login-rate-limit";

/**
 * Middleware admin: exige JWT válido E e-mail do payload presente na whitelist (RN12).
 * A whitelist é alimentada via env var ADMIN_WHITELIST (decisão revisada em 2026-05-26
 * — manter como está para 3 admins; OAuth Google adiada até crescimento do time ou
 * incidente de phishing).
 *
 * Toda chamada autenticada é logada com email + IP para auditoria (`event: 'admin.access'`).
 */
export const adminMiddleware = (
  validateWhitelist: ValidateAdminWhitelistUseCase,
  logger: ILogger
) =>
  new Elysia({ name: "admin-middleware" })
    .use(
      jwt({
        name: "jwt",
        secret: process.env.JWT_SECRET!,
        exp: process.env.JWT_EXPIRES_IN ?? "7d",
      })
    )
    .derive({ as: "scoped" }, ({ jwt, request, headers: { authorization } }) => ({
      ensureAdmin: async (): Promise<{ email: string; sub: string }> => {
        const ip = extractClientIp(request.headers);
        const path = new URL(request.url).pathname;

        if (!authorization) {
          logger.warn("Acesso admin sem token", { event: "admin.access.denied", ip, path });
          throw new UnauthorizedError("Token não fornecido.");
        }
        const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : authorization;
        const payload = await jwt.verify(token);
        if (!payload || typeof payload === "boolean") {
          logger.warn("Acesso admin com token inválido", {
            event: "admin.access.denied",
            ip,
            path,
          });
          throw new UnauthorizedError("Token inválido ou expirado.");
        }
        const email = String(payload.email ?? "");
        const sub = String(payload.sub ?? "");
        if (!email) {
          logger.warn("Acesso admin com token sem email", {
            event: "admin.access.denied",
            ip,
            path,
          });
          throw new UnauthorizedError("Token sem identificação de e-mail.");
        }
        await validateWhitelist.execute(email);
        logger.info("Acesso admin autorizado", {
          event: "admin.access.allowed",
          email,
          ip,
          path,
        });
        return { email, sub };
      },
    }));
