/**
 * Validação fail-fast das variáveis de ambiente.
 * Importado uma única vez em `index.ts` (boot do servidor) — não em testes unitários.
 */
const required = ['DATABASE_URL', 'JWT_SECRET', 'COOKIE_SECRET'] as const;

const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}. ` +
    `Configure-as antes de iniciar o servidor.`
  );
}

if ((process.env.JWT_SECRET ?? '').length < 32) {
  throw new Error('JWT_SECRET deve ter no mínimo 32 caracteres para mitigação de brute-force.');
}
if ((process.env.COOKIE_SECRET ?? '').length < 32) {
  throw new Error('COOKIE_SECRET deve ter no mínimo 32 caracteres.');
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3000),
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  COOKIE_SECRET: process.env.COOKIE_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
  RATE_LIMIT_REQUESTS: Number(process.env.RATE_LIMIT_REQUESTS ?? 30),
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  ADMIN_WHITELIST: (process.env.ADMIN_WHITELIST ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean),
} as const;
