import { describe, expect, test } from "bun:test";
import type { IStyleRepository, Style } from "../../core/ports/style.repository";
import { CreateStyleUseCase, MergeStylesUseCase } from "./admin-styles.use-case";

class MockStyleRepo implements IStyleRepository {
  private styles: Style[] = [];
  async save(s: Style) {
    this.styles.push(s);
  }
  async findAll() {
    return this.styles;
  }
  async findByName(n: string) {
    return this.styles.find((s) => s.name.toLowerCase() === n.toLowerCase()) || null;
  }
  async findById(id: string) {
    return this.styles.find((s) => s.id === id) || null;
  }
  async findByIds(ids: string[]) {
    return this.styles.filter((s) => ids.includes(s.id));
  }
  async delete(id: string) {
    this.styles = this.styles.filter((s) => s.id !== id);
  }
  async mergeStyles(s: string, t: string) {
    /* Simula o update */
  }
}

const mockLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };

describe("Admin Style Use Cases (RN10)", () => {
  test("deve criar um novo estilo", async () => {
    const repo = new MockStyleRepo();
    const useCase = new CreateStyleUseCase(repo as any, mockLogger as any);
    const style = await useCase.execute("Rock");
    expect(style.name).toBe("Rock");
  });

  test("deve unificar estilos redundantes", async () => {
    const repo = new MockStyleRepo();
    const create = new CreateStyleUseCase(repo as any, mockLogger as any);
    const merge = new MergeStylesUseCase(repo as any, mockLogger as any);

    const s1 = await create.execute("Rock");
    const s2 = await create.execute("Rock Roll");

    await merge.execute(s2.id, s1.id);

    const all = await repo.findAll();
    expect(all.length).toBe(1);
    expect(all[0]!.name).toBe("Rock");
  });
});
