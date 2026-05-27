import { and, eq, isNull } from "drizzle-orm";
import type {
  IPasswordResetTokenRepository,
  PasswordResetTokenRecord,
} from "../../../core/ports/password-reset-token.repository";
import { db } from "../client";
import { passwordResetTokens } from "../schema";

type TokenRow = typeof passwordResetTokens.$inferSelect;

function rowToRecord(row: TokenRow): PasswordResetTokenRecord {
  return {
    id: row.id,
    artistId: row.artistId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
  };
}

export class DrizzlePasswordResetTokenRepository implements IPasswordResetTokenRepository {
  async save(record: PasswordResetTokenRecord): Promise<void> {
    await db
      .insert(passwordResetTokens)
      .values({
        id: record.id,
        artistId: record.artistId,
        tokenHash: record.tokenHash,
        expiresAt: record.expiresAt,
        usedAt: record.usedAt ?? null,
      })
      .onConflictDoUpdate({
        target: passwordResetTokens.id,
        set: {
          usedAt: record.usedAt ?? null,
        },
      });
  }

  async findByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    const [row] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash));
    return row ? rowToRecord(row) : null;
  }

  async invalidateAllForArtist(artistId: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.artistId, artistId), isNull(passwordResetTokens.usedAt)));
  }
}
