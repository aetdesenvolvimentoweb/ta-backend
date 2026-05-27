/**
 * Validação fail-fast das variáveis de ambiente.
 * Importado uma única vez em `index.ts` (boot do servidor) — não em testes unitários.
 */
const required = ["DATABASE_URL", "JWT_SECRET", "COOKIE_SECRET", "PAYMENT_TOKEN_KEY"] as const;

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Variáveis de ambiente obrigatórias ausentes: ${missing.join(", ")}. ` +
      `Configure-as antes de iniciar o servidor.`
  );
}

if ((process.env.JWT_SECRET ?? "").length < 32) {
  throw new Error("JWT_SECRET deve ter no mínimo 32 caracteres para mitigação de brute-force.");
}
if ((process.env.COOKIE_SECRET ?? "").length < 32) {
  throw new Error("COOKIE_SECRET deve ter no mínimo 32 caracteres.");
}

const PINO_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
type PinoLevel = (typeof PINO_LEVELS)[number];
const rawLogLevel = (process.env.LOG_LEVEL ?? "info").toLowerCase();
if (!(PINO_LEVELS as readonly string[]).includes(rawLogLevel)) {
  throw new Error(
    `LOG_LEVEL inválido: "${process.env.LOG_LEVEL}". Use um de: ${PINO_LEVELS.join(", ")}.`
  );
}

// PAYMENT_TOKEN_KEY: 32 bytes (256 bits) em hex → 64 chars.
const tokenKey = process.env.PAYMENT_TOKEN_KEY!;
if (!/^[0-9a-fA-F]{64}$/.test(tokenKey)) {
  throw new Error(
    "PAYMENT_TOKEN_KEY deve ser uma string hex de 64 caracteres (32 bytes). Gere com: `bun -e \"console.log(crypto.getRandomValues(new Uint8Array(32)).reduce((s,b)=>s+b.toString(16).padStart(2,'0'),''))\"`"
  );
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 3000),
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  COOKIE_SECRET: process.env.COOKIE_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",
  RATE_LIMIT_REQUESTS: Number(process.env.RATE_LIMIT_REQUESTS ?? 30),
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  ADMIN_WHITELIST: (process.env.ADMIN_WHITELIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  PAYMENT_TOKEN_KEY: tokenKey,

  LOG_LEVEL: rawLogLevel as PinoLevel,

  // Mercado Pago (opcional no boot — fail-fast acontece apenas se a feature for usada).
  MP_CLIENT_ID: process.env.MP_CLIENT_ID ?? "",
  MP_CLIENT_SECRET: process.env.MP_CLIENT_SECRET ?? "",
  MP_REDIRECT_URI: process.env.MP_REDIRECT_URI ?? "",
  /** Base URL para onde o backend devolve o usuário após o callback OAuth (frontend). */
  MP_FRONTEND_RETURN_URL:
    process.env.MP_FRONTEND_RETURN_URL ?? "http://localhost:5173/payment-account",
  /** Segredo HMAC para validar webhooks do Mercado Pago. Obtenha no painel de webhooks do MP. */
  MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET ?? "",
  /** Base URL pública do frontend — usada para montar as back_urls do Checkout Pro. */
  FRONTEND_PUBLIC_BASE_URL: process.env.FRONTEND_PUBLIC_BASE_URL ?? "http://localhost:5173",
  /**
   * Restringe o Checkout Pro a PIX apenas. `true` em produção (menor taxa, UX fricção-zero).
   * Em dev/teste com vendedor sintético do MP, definir `false` — contas de teste raramente
   * conseguem habilitar PIX e o checkout ficaria sem nenhum meio disponível.
   */
  MP_PIX_ONLY: (process.env.MP_PIX_ONLY ?? "true").toLowerCase() !== "false",
  /**
   * Em dev com test users do MP: usar `sandbox_init_point` da preference. O `init_point`
   * (produção) dispara anti-fraude que exige código por email — `@testuser.com` não tem
   * caixa real, então o pagamento trava. `false` em produção.
   */
  MP_USE_SANDBOX_CHECKOUT:
    (process.env.MP_USE_SANDBOX_CHECKOUT ?? "false").toLowerCase() === "true",

  // E-mail transacional (Resend). Vazio em dev/test desabilita envio real — o
  // adapter ResendEmailService nem é instanciado se RESEND_API_KEY estiver vazio.
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  /** Remetente (deve estar verificado no painel do Resend). Ex: "Toque Aquela <no-reply@toqueaquela.app>". */
  EMAIL_FROM: process.env.EMAIL_FROM ?? "Toque Aquela <onboarding@resend.dev>",
  /** TTL do token de redefinição de senha em minutos. */
  PASSWORD_RESET_TOKEN_TTL_MIN: Number(process.env.PASSWORD_RESET_TOKEN_TTL_MIN ?? 30),
} as const;
