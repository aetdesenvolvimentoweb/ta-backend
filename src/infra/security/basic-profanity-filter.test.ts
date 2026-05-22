import { describe, expect, test } from "bun:test";
import { BasicProfanityFilter } from "./basic-profanity-filter";

describe("BasicProfanityFilter (RN08)", () => {
  test("detecta palavra ofensiva mesmo com acento", async () => {
    const f = new BasicProfanityFilter();
    expect(f.contains("seu otário")).toBe(true);
  });

  test("retorna false para texto limpo", async () => {
    const f = new BasicProfanityFilter();
    expect(f.contains("Toca aquela música top!")).toBe(false);
  });

  test("mascara palavra ofensiva mantendo o restante", async () => {
    const f = new BasicProfanityFilter();
    const cleaned = f.clean("isso é uma merda");
    expect(cleaned).not.toContain("merda");
    expect(cleaned).toContain("*****");
    expect(cleaned.toLowerCase()).toContain("isso");
  });

  test("aceita stems extras passados no construtor", async () => {
    const f = new BasicProfanityFilter(["palavraproibida"]);
    expect(f.contains("você é palavraproibida")).toBe(true);
  });

  test("não censura subpalavras que apenas contêm o stem por acaso", async () => {
    const f = new BasicProfanityFilter();
    // "porra" é stem; "porrada" tem o stem como prefixo — sufixo de até 3, então casa.
    // Mas algo como "cuidado" não deve casar com "cu" (porque removi 'cu' dos stems).
    expect(f.contains("cuidado!")).toBe(false);
  });
});
