import { expect, test, describe } from "bun:test";
import { Money } from "./money.vo";
import { ShowDuration } from "./show-duration.vo";

describe("Money Value Object", () => {
  test("deve converter centavos para real corretamente", () => {
    const money = new Money(1050); // R$ 10,50
    expect(money.toReal()).toBe(10.5);
  });

  test("deve lançar erro para valores negativos", () => {
    expect(() => new Money(-100)).toThrow("não pode ser negativo");
  });

  test("deve somar valores corretamente", () => {
    const m1 = new Money(1000);
    const m2 = new Money(500);
    expect(m1.add(m2).amountInCents).toBe(1500);
  });
});

describe("ShowDuration Value Object", () => {
  test("deve aceitar durações válidas", () => {
    expect(new ShowDuration(4).hours).toBe(4);
    expect(new ShowDuration(24).hours).toBe(24);
    expect(new ShowDuration(12).hours).toBe(12);
  });

  test("deve rejeitar durações fora do range (RN01)", () => {
    expect(() => new ShowDuration(3)).toThrow("entre 4 e 24 horas");
    expect(() => new ShowDuration(25)).toThrow("entre 4 e 24 horas");
  });
});
