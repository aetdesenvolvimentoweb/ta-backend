import { describe, expect, test } from "bun:test";
import { InMemoryOAuthStateStore } from "./oauth-state-store";

describe("InMemoryOAuthStateStore", () => {
  test("put + consume devolve a entrada e a invalida (one-shot)", () => {
    const store = new InMemoryOAuthStateStore();
    store.put("state-1", { artistId: "a1", gateway: "mercado_pago", codeVerifier: "v1" });

    const e = store.consume("state-1");
    expect(e.artistId).toBe("a1");
    expect(e.codeVerifier).toBe("v1");

    expect(() => store.consume("state-1")).toThrow("inválido ou já consumido");
  });

  test("consume em state desconhecido lança UnauthorizedError", () => {
    const store = new InMemoryOAuthStateStore();
    expect(() => store.consume("nope")).toThrow("inválido");
  });

  test("entradas expiradas são rejeitadas no consume", () => {
    const store = new InMemoryOAuthStateStore(1); // TTL 1ms
    store.put("state-2", { artistId: "a1", gateway: "mercado_pago", codeVerifier: "v1" });
    const tick = Date.now() + 10;
    while (Date.now() < tick) {
      /* spin */
    }
    expect(() => store.consume("state-2")).toThrow("expirado");
  });

  test("sweep remove entradas vencidas e preserva as válidas", () => {
    const store = new InMemoryOAuthStateStore(10_000);
    store.put("fresh", { artistId: "a1", gateway: "mercado_pago", codeVerifier: "v" });

    // Sweep no tempo presente: nada deveria expirar ainda.
    store.sweep(Date.now());
    expect(store.consume("fresh").artistId).toBe("a1");

    store.put("soon", { artistId: "a2", gateway: "mercado_pago", codeVerifier: "v" });
    // Sweep 1 minuto no futuro: 'soon' deve ter sido removido.
    store.sweep(Date.now() + 60_000);
    expect(() => store.consume("soon")).toThrow("inválido ou já consumido");
  });
});
