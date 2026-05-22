import { describe, expect, test } from "bun:test";
import { Money } from "./money.vo";
import { isSupportedGateway, PaymentAccount } from "./payment-account.vo";
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
    expect(() => new ShowDuration(0)).toThrow("entre 1 e 24 horas");
    expect(() => new ShowDuration(25)).toThrow("entre 1 e 24 horas");
    expect(() => new ShowDuration(2.5)).toThrow("entre 1 e 24 horas");
  });

  test("deve aceitar 1h como mínimo", () => {
    expect(new ShowDuration(1).hours).toBe(1);
  });
});

describe("PaymentAccount Value Object", () => {
  test("deve criar uma conta válida e fazer trim do externalAccountId", () => {
    const account = new PaymentAccount("mercado_pago", "  mp-collector-123  ");
    expect(account.gateway).toBe("mercado_pago");
    expect(account.externalAccountId).toBe("mp-collector-123");
    expect(account.connectedAt).toBeInstanceOf(Date);
  });

  test("deve rejeitar gateway não suportado (RN14)", () => {
    expect(() => new PaymentAccount("paypal" as any, "id")).toThrow("não suportado");
  });

  test("deve rejeitar externalAccountId vazio (RN17 — identidade externa obrigatória)", () => {
    expect(() => new PaymentAccount("mercado_pago", "   ")).toThrow("obrigatório");
  });

  test("isSupportedGateway: deve aceitar gateways conhecidos", () => {
    expect(isSupportedGateway("mercado_pago")).toBe(true);
    expect(isSupportedGateway("stripe")).toBe(true);
    expect(isSupportedGateway("pagarme")).toBe(true);
    expect(isSupportedGateway("paypal")).toBe(false);
  });
});
