import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não configurada nas variáveis de ambiente.");
}

/**
 * Cliente de conexão com o PostgreSQL.
 * O driver 'postgres-js' é altamente performático e compatível com Bun.
 */
export const client = postgres(connectionString, {
  max: process.env.NODE_ENV === 'production' ? 20 : 5, // Limita pool em dev/test
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

/**
 * Helper para fechar a conexão (útil em testes).
 */
export const closeDb = async () => {
  await client.end();
};
