import { eq, and, desc, count, sql } from "drizzle-orm";
import { db } from "../client";
import { musicRequests, songs, shows, artists } from "../schema";
import { MusicRequest } from "../../../core/entities/music-request.entity";
import { Money } from "../../../core/value-objects/money.vo";
import { isSupportedGateway } from "../../../core/value-objects/payment-account.vo";
import type { IMusicRequestRepository } from "../../../core/ports/music-request.repository";
import type { RequestPayment } from "../../../core/entities/music-request.entity";

type MusicRequestRow = typeof musicRequests.$inferSelect;

function rowToRequest(row: MusicRequestRow): MusicRequest {
  let payment: RequestPayment | null = null;
  if (row.paymentGateway && row.paymentId && row.paymentStatus && isSupportedGateway(row.paymentGateway)) {
    payment = {
      gateway: row.paymentGateway,
      paymentId: row.paymentId,
      status: row.paymentStatus,
    };
  }
  return new MusicRequest(
    row.id,
    row.showId,
    row.songId,
    row.customerName,
    row.customerSessionId,
    row.message,
    new Money(row.tipAmountCents),
    row.status,
    row.createdAt,
    payment
  );
}

/**
 * Implementação do repositório de Pedidos de Música usando Drizzle ORM.
 */
export class DrizzleMusicRequestRepository implements IMusicRequestRepository {

  async save(request: MusicRequest): Promise<void> {
    await db.insert(musicRequests).values({
      id: request.id,
      showId: request.showId,
      songId: request.songId,
      customerName: request.customerName,
      customerSessionId: request.customerSessionId,
      message: request.message,
      tipAmountCents: request.tip.amountInCents,
      status: request.status,
      createdAt: request.createdAt,
      paymentGateway: request.payment?.gateway ?? null,
      paymentId: request.payment?.paymentId ?? null,
      paymentStatus: request.payment?.status ?? null,
    }).onConflictDoUpdate({
      target: musicRequests.id,
      set: {
        status: request.status,
        tipAmountCents: request.tip.amountInCents,
        paymentGateway: request.payment?.gateway ?? null,
        paymentId: request.payment?.paymentId ?? null,
        paymentStatus: request.payment?.status ?? null,
      }
    });
  }

  async findById(id: string): Promise<MusicRequest | null> {
    const [row] = await db.select().from(musicRequests).where(eq(musicRequests.id, id));
    return row ? rowToRequest(row) : null;
  }

  async findByShowId(showId: string): Promise<MusicRequest[]> {
    const rows = await db.select().from(musicRequests)
      .where(eq(musicRequests.showId, showId))
      .orderBy(desc(musicRequests.tipAmountCents), musicRequests.createdAt);
    return rows.map(rowToRequest);
  }

  /**
   * Busca pedidos por sessão para validar RN09 (1 pedido gratuito).
   */
  async findBySessionId(showId: string, sessionId: string): Promise<MusicRequest[]> {
    const rows = await db.select().from(musicRequests)
      .where(
        and(
          eq(musicRequests.showId, showId),
          eq(musicRequests.customerSessionId, sessionId)
        )
      );
    return rows.map(rowToRequest);
  }

  async countFreeRequestsByCustomer(showId: string, customerSessionId: string): Promise<number> {
    const [result] = await db.select({ total: count() }).from(musicRequests)
      .where(
        and(
          eq(musicRequests.showId, showId),
          eq(musicRequests.customerSessionId, customerSessionId),
          eq(musicRequests.tipAmountCents, 0)
        )
      );
    return result?.total ?? 0;
  }

  /**
   * RN03: Atualiza todos os pedidos pendentes de uma música para 'played'.
   */
  async updateStatusBySong(showId: string, songId: string, status: 'pending' | 'played' | 'cancelled' | 'refunded'): Promise<void> {
    await db.update(musicRequests)
      .set({ status })
      .where(
        and(
          eq(musicRequests.showId, showId),
          eq(musicRequests.songId, songId),
          eq(musicRequests.status, 'pending')
        )
      );
  }

  async aggregateAppMetrics(): Promise<{
    totalVolumeCents: number;
    topSongsByRequestCount: { title: string; count: number }[];
    topArtistsByRevenue: { name: string; revenueCents: number }[];
  }> {
    const [volume] = await db
      .select({ total: sql<number>`COALESCE(SUM(${musicRequests.tipAmountCents}), 0)::int` })
      .from(musicRequests)
      .where(eq(musicRequests.status, 'played'));

    const topSongsRows = await db
      .select({
        title: songs.title,
        count: sql<number>`COUNT(${musicRequests.id})::int`.as('cnt'),
      })
      .from(musicRequests)
      .innerJoin(songs, eq(songs.id, musicRequests.songId))
      .groupBy(songs.title)
      .orderBy(sql`cnt DESC`)
      .limit(10);

    const topArtistsRows = await db
      .select({
        name: artists.name,
        revenueCents: sql<number>`COALESCE(SUM(${musicRequests.tipAmountCents}), 0)::int`.as('revenue'),
      })
      .from(musicRequests)
      .innerJoin(shows, eq(shows.id, musicRequests.showId))
      .innerJoin(artists, eq(artists.id, shows.artistId))
      .where(eq(musicRequests.status, 'played'))
      .groupBy(artists.name)
      .orderBy(sql`revenue DESC`)
      .limit(10);

    return {
      totalVolumeCents: Number(volume?.total ?? 0),
      topSongsByRequestCount: topSongsRows.map(r => ({ title: r.title, count: Number(r.count) })),
      topArtistsByRevenue: topArtistsRows.map(r => ({ name: r.name, revenueCents: Number(r.revenueCents) })),
    };
  }

  async aggregateArtistMetrics(artistId: string): Promise<{
    totalEarnedCents: number;
    totalRequestsPlayed: number;
  }> {
    const [row] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${musicRequests.tipAmountCents}), 0)::int`,
        played: sql<number>`COUNT(${musicRequests.id})::int`,
      })
      .from(musicRequests)
      .innerJoin(shows, eq(shows.id, musicRequests.showId))
      .where(and(eq(shows.artistId, artistId), eq(musicRequests.status, 'played')));

    return {
      totalEarnedCents: Number(row?.total ?? 0),
      totalRequestsPlayed: Number(row?.played ?? 0),
    };
  }
}
