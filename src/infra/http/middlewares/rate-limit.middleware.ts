import { Elysia } from "elysia";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Rate limiter in-memory (token bucket por janela fixa).
 * Para múltiplas instâncias em produção, substituir por Redis.
 */
export const rateLimit = (opts: { windowMs: number; max: number; name?: string }) => {
  const buckets = new Map<string, Bucket>();

  // GC leve para evitar crescimento ilimitado da Map.
  const sweep = () => {
    const now = Date.now();
    for (const [key, b] of buckets) {
      if (b.resetAt < now) buckets.delete(key);
    }
  };
  const sweepInterval = setInterval(sweep, opts.windowMs).unref?.();

  return new Elysia({ name: opts.name ?? "rate-limit" })
    .onStop(() => {
      if (sweepInterval) clearInterval(sweepInterval);
    })
    .onRequest(({ request, set }) => {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";

      const now = Date.now();
      const bucket = buckets.get(ip);

      if (!bucket || bucket.resetAt < now) {
        buckets.set(ip, { count: 1, resetAt: now + opts.windowMs });
        return;
      }

      bucket.count += 1;
      if (bucket.count > opts.max) {
        set.status = 429;
        set.headers["retry-after"] = String(Math.ceil((bucket.resetAt - now) / 1000));
        return {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Muitas requisições. Tente novamente em alguns instantes.",
        };
      }
    });
};
