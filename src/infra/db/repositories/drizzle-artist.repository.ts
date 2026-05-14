import { eq } from "drizzle-orm";
import { db } from "../client";
import { artists } from "../schema";
import { Artist } from "../../../core/entities/artist.entity";
import { Email } from "../../../core/value-objects/email.vo";
import type { IArtistRepository } from "../../../core/ports/artist.repository";

/**
 * Implementação do repositório de Artistas usando Drizzle ORM.
 */
export class DrizzleArtistRepository implements IArtistRepository {
  
  async save(artist: Artist): Promise<void> {
    await db.insert(artists).values({
      id: artist.id,
      name: artist.name,
      email: artist.email.getValue(),
      passwordHash: artist.passwordHash,
      isPremium: artist.isPremium,
      socials: artist.socials,
    }).onConflictDoUpdate({
      target: artists.id,
      set: {
        name: artist.name,
        passwordHash: artist.passwordHash,
        isPremium: artist.isPremium,
        socials: artist.socials,
      }
    });
  }

  async findByEmail(email: string): Promise<Artist | null> {
    const [row] = await db.select().from(artists).where(eq(artists.email, email.toLowerCase().trim()));
    
    if (!row) return null;

    return new Artist(
      row.id,
      row.name,
      new Email(row.email),
      row.passwordHash || undefined,
      row.socials || {},
      row.isPremium
    );
  }

  async findById(id: string): Promise<Artist | null> {
    const [row] = await db.select().from(artists).where(eq(artists.id, id));
    
    if (!row) return null;

    return new Artist(
      row.id,
      row.name,
      new Email(row.email),
      row.passwordHash || undefined,
      row.socials || {},
      row.isPremium
    );
  }

  async delete(id: string): Promise<void> {
    await db.delete(artists).where(eq(artists.id, id));
  }
}
