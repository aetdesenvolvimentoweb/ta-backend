import { describe, expect, test } from "bun:test";
import { ShowDuration } from "../value-objects/show-duration.vo";
import { Show } from "./show.entity";

describe("Show Entity", () => {
  test("deve detectar show expirado corretamente (RN01)", () => {
    const pastDate = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5 horas atrás
    const duration = new ShowDuration(4); // Duração de 4 horas

    const show = new Show("1", "artist-1", pastDate, duration);

    expect(show.isExpired()).toBe(true);
  });

  test("deve manter show ativo se estiver dentro da duração", () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hora atrás
    const duration = new ShowDuration(4);

    const show = new Show("1", "artist-1", recentDate, duration);

    expect(show.isExpired()).toBe(false);
  });
});
