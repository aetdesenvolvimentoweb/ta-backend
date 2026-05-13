import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

/**
 * Tabela de Estilos Musicais
 */
export const styles = pgTable("styles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
});

/**
 * Tabela de Artistas
 */
export const artists = pgTable("artists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // Adicionado para futura autenticação real
  isPremium: boolean("is_premium").default(false).notNull(),
  socials: jsonb("socials").$type<Record<string, string>>().default({}).notNull(),
});

/**
 * Tabela de Shows
 */
export const shows = pgTable("shows", {
  id: uuid("id").primaryKey().defaultRandom(),
  artistId: uuid("artist_id").references(() => artists.id).notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  durationHours: integer("duration_hours").notNull(),
  status: text("status").$type<'active' | 'finished' | 'expired'>().default('active').notNull(),
});

/**
 * Tabela de Repertório (Músicas)
 */
export const songs = pgTable("songs", {
  id: uuid("id").primaryKey().defaultRandom(),
  artistId: uuid("artist_id").references(() => artists.id).notNull(),
  title: text("title").notNull(),
  originalArtist: text("original_artist").notNull(),
  styleId: uuid("style_id").references(() => styles.id),
  isAvailable: boolean("is_available").default(true).notNull(),
});

/**
 * Tabela de Pedidos de Música
 */
export const musicRequests = pgTable("music_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  showId: uuid("show_id").references(() => shows.id).notNull(),
  songId: uuid("song_id").references(() => songs.id).notNull(),
  customerName: text("customer_name").notNull(),
  customerSessionId: text("customer_session_id"), // Para RN09
  message: text("message"),
  tipAmountCents: integer("tip_amount_cents").default(0).notNull(),
  status: text("status").$type<'pending' | 'played' | 'cancelled' | 'refunded'>().default('pending').notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
