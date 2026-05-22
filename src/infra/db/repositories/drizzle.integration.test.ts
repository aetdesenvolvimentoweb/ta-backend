import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { Artist } from "../../../core/entities/artist.entity";
import { Show } from "../../../core/entities/show.entity";
import { Email } from "../../../core/value-objects/email.vo";
import { ShowDuration } from "../../../core/value-objects/show-duration.vo";
import { closeDb, db } from "../client";
import { DrizzleArtistRepository } from "./drizzle-artist.repository";
import { DrizzleShowRepository } from "./drizzle-show.repository";

/**
 * Testes de Integração para Repositórios Drizzle.
 * Estes testes rodam contra um banco PostgreSQL REAL (definido em .env.test).
 */
describe("Drizzle Repositories Integration", () => {
  // Limpeza do banco antes de cada teste para garantir isolação absoluta
  beforeEach(async () => {
    // Ordem inversa das foreign keys
    await db.execute(
      sql`TRUNCATE TABLE music_requests, songs, shows, artists, styles RESTART IDENTITY CASCADE`
    );
  });

  afterAll(async () => {
    await closeDb();
  });

  test("deve persistir e recuperar um artista", async () => {
    const repo = new DrizzleArtistRepository();
    const artist = new Artist(crypto.randomUUID(), "Drizzle Artist", new Email("drizzle@test.com"));

    await repo.save(artist);

    const saved = await repo.findById(artist.id);
    expect(saved).not.toBeNull();
    expect(saved?.name).toBe("Drizzle Artist");
    expect(saved?.email.getValue()).toBe("drizzle@test.com");
  });

  test("deve persistir um show e marcar como expirado via SQL", async () => {
    const artistRepo = new DrizzleArtistRepository();
    const showRepo = new DrizzleShowRepository();

    const artist = new Artist(crypto.randomUUID(), "Show Artist", new Email("show@test.com"));
    await artistRepo.save(artist);

    // Show que começou há 5 horas e durava 4h (já expirado)
    const startTime = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const show = new Show(crypto.randomUUID(), artist.id, startTime, new ShowDuration(4), "active");

    await showRepo.save(show);

    // Rodar a lógica de expiração nativa do SQL
    await showRepo.markExpiredShows();

    const updated = await showRepo.findById(show.id);
    expect(updated?.status).toBe("expired");
  });

  test("deve encontrar artista por e-mail", async () => {
    const repo = new DrizzleArtistRepository();
    const artist = new Artist(
      crypto.randomUUID(),
      "Email Artist",
      new Email("email@test.com"),
      "hash123"
    );

    await repo.save(artist);

    const found = await repo.findByEmail("email@test.com");
    expect(found).not.toBeNull();
    expect(found?.name).toBe("Email Artist");
    expect(found?.passwordHash).toBe("hash123");

    const notFound = await repo.findByEmail("inexistente@test.com");
    expect(notFound).toBeNull();
  });

  test("deve deletar um artista", async () => {
    const repo = new DrizzleArtistRepository();
    const artist = new Artist(crypto.randomUUID(), "Delete Artist", new Email("delete@test.com"));

    await repo.save(artist);
    await repo.delete(artist.id);

    const found = await repo.findById(artist.id);
    expect(found).toBeNull();
  });

  test("deve encontrar show ativo por artista", async () => {
    const artistRepo = new DrizzleArtistRepository();
    const showRepo = new DrizzleShowRepository();

    const artist = new Artist(
      crypto.randomUUID(),
      "Active Show Artist",
      new Email("active@test.com")
    );
    await artistRepo.save(artist);

    const show = new Show(
      crypto.randomUUID(),
      artist.id,
      new Date(),
      new ShowDuration(4),
      "active"
    );
    await showRepo.save(show);

    const found = await showRepo.findActiveByArtistId(artist.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(show.id);
    expect(found?.status).toBe("active");

    // Artista sem show ativo retorna null
    const notFound = await showRepo.findActiveByArtistId(crypto.randomUUID());
    expect(notFound).toBeNull();
  });

  test("deve listar todos os shows", async () => {
    const artistRepo = new DrizzleArtistRepository();
    const showRepo = new DrizzleShowRepository();

    const artist = new Artist(crypto.randomUUID(), "List Artist", new Email("list@test.com"));
    await artistRepo.save(artist);

    await showRepo.save(
      new Show(crypto.randomUUID(), artist.id, new Date(), new ShowDuration(4), "active")
    );
    await showRepo.save(
      new Show(crypto.randomUUID(), artist.id, new Date(), new ShowDuration(4), "finished")
    );

    const all = await showRepo.findAll();
    expect(all.length).toBe(2);
  });
});
