import { eq, ilike, inArray } from "drizzle-orm";
import type { IStyleRepository, Style } from "../../../core/ports/style.repository";
import { db } from "../client";
import { songs, styles } from "../schema";

/**
 * Implementação do repositório de Estilos Musicais usando Drizzle ORM.
 */
export class DrizzleStyleRepository implements IStyleRepository {
  async save(style: Style): Promise<void> {
    await db
      .insert(styles)
      .values({
        id: style.id,
        name: style.name,
      })
      .onConflictDoUpdate({
        target: styles.id,
        set: { name: style.name },
      });
  }

  async findByName(name: string): Promise<Style | null> {
    const [row] = await db.select().from(styles).where(ilike(styles.name, name.trim()));
    return row || null;
  }

  async findById(id: string): Promise<Style | null> {
    const [row] = await db.select().from(styles).where(eq(styles.id, id));
    return row || null;
  }

  async findByIds(ids: string[]): Promise<Style[]> {
    if (ids.length === 0) return [];
    return await db.select().from(styles).where(inArray(styles.id, ids));
  }

  async findAll(): Promise<Style[]> {
    return await db.select().from(styles);
  }

  async delete(id: string): Promise<void> {
    await db.delete(styles).where(eq(styles.id, id));
  }

  /**
   * RN10: Unifica estilos. Ex: Rock Roll -> Rock.
   * Atualiza todas as músicas que usavam o estilo antigo para o novo.
   */
  async mergeStyles(sourceStyleId: string, targetStyleId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // 1. Atualizar as músicas
      await tx
        .update(songs)
        .set({ styleId: targetStyleId })
        .where(eq(songs.styleId, sourceStyleId));

      // 2. Deletar o estilo antigo
      await tx.delete(styles).where(eq(styles.id, sourceStyleId));
    });
  }
}
