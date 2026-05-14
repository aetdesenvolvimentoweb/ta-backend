import { eq, and, sql } from "drizzle-orm";
import { db } from "../client";
import { shows } from "../schema";
import { Show } from "../../../core/entities/show.entity";
import { ShowDuration } from "../../../core/value-objects/show-duration.vo";
import type { IShowRepository } from "../../../core/ports/show.repository";

/**
 * Implementação do repositório de Shows usando Drizzle ORM.
 */
export class DrizzleShowRepository implements IShowRepository {
  
  async save(show: Show): Promise<void> {
    await db.insert(shows).values({
      id: show.id,
      artistId: show.artistId,
      startTime: show.startTime,
      durationHours: show.duration.hours,
      status: show.status,
    }).onConflictDoUpdate({
      target: shows.id,
      set: {
        status: show.status
      }
    });
  }

  async findById(id: string): Promise<Show | null> {
    const [row] = await db.select().from(shows).where(eq(shows.id, id));
    if (!row) return null;

    return new Show(
      row.id,
      row.artistId,
      row.startTime,
      new ShowDuration(row.durationHours),
      row.status
    );
  }

  async findActiveByArtistId(artistId: string): Promise<Show | null> {
    const [row] = await db.select().from(shows).where(
      and(
        eq(shows.artistId, artistId),
        eq(shows.status, 'active')
      )
    );
    
    if (!row) return null;

    return new Show(
      row.id,
      row.artistId,
      row.startTime,
      new ShowDuration(row.durationHours),
      row.status
    );
  }

  async findAll(): Promise<Show[]> {
    const rows = await db.select().from(shows);
    return rows.map(row => new Show(
      row.id,
      row.artistId,
      row.startTime,
      new ShowDuration(row.durationHours),
      row.status
    ));
  }

  /**
   * RN01: Marca como 'expired' todos os shows onde o tempo atual ultrapassou a duração prevista.
   */
  async markExpiredShows(): Promise<void> {
    await db.update(shows)
      .set({ status: 'expired' })
      .where(
        and(
          eq(shows.status, 'active'),
          sql`${shows.startTime} + (interval '1 hour' * ${shows.durationHours}) < now()`
        )
      );
  }
}
