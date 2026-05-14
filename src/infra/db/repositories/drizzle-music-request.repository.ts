import { eq, and, desc, count } from "drizzle-orm";
import { db } from "../client";
import { musicRequests } from "../schema";
import { MusicRequest } from "../../../core/entities/music-request.entity";
import { Money } from "../../../core/value-objects/money.vo";
import type { IMusicRequestRepository } from "../../../core/ports/music-request.repository";

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
    }).onConflictDoUpdate({
      target: musicRequests.id,
      set: {
        status: request.status,
        tipAmountCents: request.tip.amountInCents
      }
    });
  }

  async findById(id: string): Promise<MusicRequest | null> {
    const [row] = await db.select().from(musicRequests).where(eq(musicRequests.id, id));
    if (!row) return null;

    return new MusicRequest(
      row.id,
      row.showId,
      row.songId,
      row.customerName,
      row.customerSessionId,
      row.message,
      new Money(row.tipAmountCents),
      row.status,
      row.createdAt
    );
  }

  async findByShowId(showId: string): Promise<MusicRequest[]> {
    const rows = await db.select().from(musicRequests)
      .where(eq(musicRequests.showId, showId))
      .orderBy(desc(musicRequests.tipAmountCents), musicRequests.createdAt);
    
    return rows.map(row => new MusicRequest(
      row.id,
      row.showId,
      row.songId,
      row.customerName,
      row.customerSessionId,
      row.message,
      new Money(row.tipAmountCents),
      row.status,
      row.createdAt
    ));
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
    
    return rows.map(row => new MusicRequest(
      row.id,
      row.showId,
      row.songId,
      row.customerName,
      row.customerSessionId,
      row.message,
      new Money(row.tipAmountCents),
      row.status,
      row.createdAt
    ));
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
}
