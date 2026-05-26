import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Show } from "../../../core/entities/show.entity";
import type { IShowRepository, ShowWithStats } from "../../../core/ports/show.repository";
import { ShowDuration } from "../../../core/value-objects/show-duration.vo";
import { db } from "../client";
import { musicRequests, shows } from "../schema";

/**
 * Implementação do repositório de Shows usando Drizzle ORM.
 */
export class DrizzleShowRepository implements IShowRepository {
  async save(show: Show): Promise<void> {
    await db
      .insert(shows)
      .values({
        id: show.id,
        artistId: show.artistId,
        startTime: show.startTime,
        durationHours: show.duration.hours,
        status: show.status,
      })
      .onConflictDoUpdate({
        target: shows.id,
        set: {
          status: show.status,
        },
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
    const [row] = await db
      .select()
      .from(shows)
      .where(and(eq(shows.artistId, artistId), eq(shows.status, "active")));

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
    return rows.map(
      (row) =>
        new Show(
          row.id,
          row.artistId,
          row.startTime,
          new ShowDuration(row.durationHours),
          row.status
        )
    );
  }

  /**
   * RN01: Marca como 'expired' todos os shows onde o tempo atual ultrapassou a duração prevista.
   */
  async markExpiredShows(): Promise<void> {
    await db
      .update(shows)
      .set({ status: "expired" })
      .where(
        and(
          eq(shows.status, "active"),
          sql`${shows.startTime} + (interval '1 hour' * ${shows.durationHours}) < now()`
        )
      );
  }

  async findHistoryByArtistId(artistId: string, limit = 50): Promise<ShowWithStats[]> {
    const rows = await db
      .select({
        id: shows.id,
        artistId: shows.artistId,
        startTime: shows.startTime,
        durationHours: shows.durationHours,
        status: shows.status,
        totalRequests: sql<number>`COUNT(${musicRequests.id})::int`.as("total_requests"),
        totalPlayed:
          sql<number>`COUNT(${musicRequests.id}) FILTER (WHERE ${musicRequests.status} = 'played')::int`.as(
            "total_played"
          ),
        totalTipsGrossCents:
          sql<number>`COALESCE(SUM(${musicRequests.tipAmountCents}) FILTER (WHERE ${musicRequests.status} = 'played'), 0)::int`.as(
            "total_tips_gross_cents"
          ),
      })
      .from(shows)
      .leftJoin(musicRequests, eq(musicRequests.showId, shows.id))
      .where(and(eq(shows.artistId, artistId), inArray(shows.status, ["finished", "expired"])))
      .groupBy(shows.id)
      .orderBy(desc(shows.startTime))
      .limit(limit);

    return rows.map((row) => ({
      show: new Show(
        row.id,
        row.artistId,
        row.startTime,
        new ShowDuration(row.durationHours),
        row.status
      ),
      totalRequests: Number(row.totalRequests),
      totalPlayed: Number(row.totalPlayed),
      totalTipsGrossCents: Number(row.totalTipsGrossCents),
    }));
  }
}
