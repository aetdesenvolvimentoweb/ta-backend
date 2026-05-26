/**
 * Rate limit dedicado para a rota `/artists/login`, mais agressivo que o
 * limite global da aplicação. Protege contra credential stuffing e brute
 * force lento sem afetar o fluxo de cadastro.
 *
 * Janela fixa de 15 minutos por IP, até 5 tentativas. O bucket é zerado em
 * qualquer login bem-sucedido para não punir o usuário legítimo.
 *
 * Para >1 instância, mover esse estado para Redis (mesmo trade-off do
 * rateLimit global em `rate-limit.middleware.ts`).
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
let lastSweep = Date.now();

function sweepIfStale(now: number): void {
  if (now - lastSweep <= WINDOW_MS) return;
  for (const [ip, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(ip);
  }
  lastSweep = now;
}

export interface LoginRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Registra uma nova tentativa de login e devolve se ela deve ser aceita.
 * Chamar ANTES de tentar autenticar.
 */
export function recordLoginAttempt(ip: string): LoginRateLimitResult {
  const now = Date.now();
  sweepIfStale(now);

  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Limpa o bucket do IP após login bem-sucedido — o usuário legítimo
 * não fica punido se errou a senha algumas vezes e acertou na última.
 */
export function resetLoginAttempts(ip: string): void {
  buckets.delete(ip);
}

export function extractClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown"
  );
}
