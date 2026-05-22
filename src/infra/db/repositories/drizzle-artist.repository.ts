import { eq } from "drizzle-orm";
import { Artist } from "../../../core/entities/artist.entity";
import type { IArtistRepository } from "../../../core/ports/artist.repository";
import { Email } from "../../../core/value-objects/email.vo";
import { isSupportedGateway, PaymentAccount } from "../../../core/value-objects/payment-account.vo";
import { db } from "../client";
import { artists } from "../schema";

type ArtistRow = typeof artists.$inferSelect;

function rowToArtist(row: ArtistRow): Artist {
  let paymentAccount: PaymentAccount | undefined;
  if (
    row.paymentGateway &&
    row.paymentExternalAccountId &&
    isSupportedGateway(row.paymentGateway)
  ) {
    paymentAccount = new PaymentAccount(
      row.paymentGateway,
      row.paymentExternalAccountId,
      row.paymentConnectedAt ?? new Date()
    );
  }

  return new Artist(
    row.id,
    row.name,
    new Email(row.email),
    row.passwordHash || undefined,
    row.socials || {},
    row.isPremium,
    paymentAccount
  );
}

/**
 * Repositório de Artistas (Drizzle).
 *
 * Persiste apenas os campos públicos da conta de pagamento (gateway + externalAccountId + connectedAt).
 * Tokens OAuth são manipulados por uma camada separada (futura) — RN17/22 garantem que nunca
 * entrem no domínio em texto plano.
 */
export class DrizzleArtistRepository implements IArtistRepository {
  async save(artist: Artist): Promise<void> {
    const pa = artist.paymentAccount;
    await db
      .insert(artists)
      .values({
        id: artist.id,
        name: artist.name,
        email: artist.email.getValue(),
        passwordHash: artist.passwordHash,
        isPremium: artist.isPremium,
        socials: artist.socials,
        paymentGateway: pa?.gateway ?? null,
        paymentExternalAccountId: pa?.externalAccountId ?? null,
        paymentConnectedAt: pa?.connectedAt ?? null,
      })
      .onConflictDoUpdate({
        target: artists.id,
        set: {
          name: artist.name,
          passwordHash: artist.passwordHash,
          isPremium: artist.isPremium,
          socials: artist.socials,
          paymentGateway: pa?.gateway ?? null,
          paymentExternalAccountId: pa?.externalAccountId ?? null,
          paymentConnectedAt: pa?.connectedAt ?? null,
        },
      });
  }

  async findByEmail(email: string): Promise<Artist | null> {
    const [row] = await db
      .select()
      .from(artists)
      .where(eq(artists.email, email.toLowerCase().trim()));
    return row ? rowToArtist(row) : null;
  }

  async findById(id: string): Promise<Artist | null> {
    const [row] = await db.select().from(artists).where(eq(artists.id, id));
    return row ? rowToArtist(row) : null;
  }

  async delete(id: string): Promise<void> {
    await db.delete(artists).where(eq(artists.id, id));
  }
}
