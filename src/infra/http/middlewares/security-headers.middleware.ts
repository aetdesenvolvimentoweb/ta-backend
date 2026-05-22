import { Elysia } from "elysia";

/**
 * Headers de segurança alinhados com OWASP Secure Headers.
 * Como esta é uma API JSON (não HTML), CSP é mínima.
 */
export const securityHeaders = new Elysia({ name: "security-headers" }).onAfterHandle(({ set }) => {
  set.headers["x-content-type-options"] = "nosniff";
  set.headers["x-frame-options"] = "DENY";
  set.headers["referrer-policy"] = "no-referrer";
  set.headers["permissions-policy"] = "geolocation=(), microphone=(), camera=()";
  if (process.env.NODE_ENV === "production") {
    set.headers["strict-transport-security"] = "max-age=31536000; includeSubDomains";
  }
});
