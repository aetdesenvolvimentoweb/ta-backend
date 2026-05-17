import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não configurada nas variáveis de ambiente.");
}

export type DB = NeonHttpDatabase<typeof schema> | PostgresJsDatabase<typeof schema>;

let _db: DB;
let _close: () => Promise<void>;

if (connectionString.includes(".neon.tech")) {
  // Produção (Neon): driver HTTP — sem pool persistente, sem conexões obsoletas.
  // Cada query é uma requisição HTTP independente ao proxy do Neon.
  const sql = neon(connectionString);
  _db = drizzleHttp(sql, { schema });
  _close = async () => {};
} else {
  // Desenvolvimento / testes: postgres-js com pool conservador.
  const client = postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  _db = drizzlePg(client, { schema });
  _close = async () => { await client.end(); };
}

export const db: DB = _db;

export const closeDb = _close;
