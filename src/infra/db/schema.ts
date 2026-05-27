import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Tabela de Estilos Musicais
 */
export const styles = pgTable("styles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
});

/**
 * Tabela de Artistas
 *
 * Campos `payment*` (RN14/RN15/RN17):
 *  - `paymentGateway` + `paymentExternalAccountId` identificam a conta conectada (collector).
 *  - `paymentAccessTokenEnc` / `paymentRefreshTokenEnc` armazenam tokens OAuth criptografados em repouso.
 *  - Nenhum dado fiscal (CPF, conta bancária, PIX) é armazenado — RN17.
 */
export const artists = pgTable("artists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  isPremium: boolean("is_premium").default(false).notNull(),
  socials: jsonb("socials").$type<Record<string, string>>().default({}).notNull(),

  paymentGateway: text("payment_gateway").$type<"mercado_pago" | "stripe" | "pagarme">(),
  paymentExternalAccountId: text("payment_external_account_id"),
  paymentAccessTokenEnc: text("payment_access_token_enc"),
  paymentRefreshTokenEnc: text("payment_refresh_token_enc"),
  paymentTokenExpiresAt: timestamp("payment_token_expires_at", { withTimezone: true }),
  paymentConnectedAt: timestamp("payment_connected_at", { withTimezone: true }),
});

/**
 * Tabela de tokens de redefinição de senha.
 *
 * Apenas o hash SHA-256 do token é persistido — o token em si vai por e-mail
 * e nunca trafega em log/DB. `usedAt` é setado no consumo (single-use) e o
 * cron de limpeza pode remover registros com `expiresAt < now() - 7d`.
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .references(() => artists.id)
      .notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_password_reset_artist_id").on(t.artistId)]
);

/**
 * Tabela de Shows
 */
export const shows = pgTable(
  "shows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .references(() => artists.id)
      .notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    durationHours: integer("duration_hours").notNull(),
    status: text("status").$type<"active" | "finished" | "expired">().default("active").notNull(),
  },
  (t) => [index("idx_shows_artist_id").on(t.artistId), index("idx_shows_status").on(t.status)]
);

/**
 * Tabela de Repertório (Músicas)
 */
export const songs = pgTable(
  "songs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .references(() => artists.id)
      .notNull(),
    title: text("title").notNull(),
    originalArtist: text("original_artist").notNull(),
    styleId: uuid("style_id").references(() => styles.id),
    isAvailable: boolean("is_available").default(true).notNull(),
  },
  (t) => [index("idx_songs_artist_id").on(t.artistId), index("idx_songs_style_id").on(t.styleId)]
);

/**
 * Tabela de Pedidos de Música
 *
 * Campos `payment*` (RN16/RN18):
 *  - Só preenchidos quando `tipAmountCents > 0`.
 *  - `paymentId` é o identificador devolvido pelo gateway; `paymentGateway` identifica qual adapter o emitiu.
 *  - `paymentStatus` espelha o status no gateway (atualizado por webhook).
 */
export const musicRequests = pgTable(
  "music_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    showId: uuid("show_id")
      .references(() => shows.id)
      .notNull(),
    songId: uuid("song_id")
      .references(() => songs.id)
      .notNull(),
    customerName: text("customer_name").notNull(),
    customerSessionId: text("customer_session_id"),
    message: text("message"),
    tipAmountCents: integer("tip_amount_cents").default(0).notNull(),
    status: text("status")
      .$type<"pending" | "played" | "cancelled" | "refunded">()
      .default("pending")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

    paymentGateway: text("payment_gateway").$type<"mercado_pago" | "stripe" | "pagarme">(),
    paymentId: text("payment_id"),
    paymentStatus: text("payment_status").$type<"pending" | "approved" | "rejected" | "refunded">(),
  },
  (t) => [
    index("idx_music_requests_show_id").on(t.showId),
    index("idx_music_requests_payment_id").on(t.paymentId),
    index("idx_music_requests_status").on(t.status),
    index("idx_music_requests_session_show").on(t.customerSessionId, t.showId),
  ]
);
