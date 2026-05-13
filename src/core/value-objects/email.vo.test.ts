import { expect, test, describe } from "bun:test";
import { Email } from "./email.vo";

describe("Email Value Object", () => {
  test("deve criar um e-mail válido", () => {
    const emailStr = "teste@exemplo.com";
    const email = new Email(emailStr);
    expect(email.getValue()).toBe(emailStr);
  });

  test("deve converter e-mail para minúsculas", () => {
    const email = new Email("TESTE@Exemplo.COM");
    expect(email.getValue()).toBe("teste@exemplo.com");
  });

  test("deve lançar erro para e-mail inválido", () => {
    expect(() => new Email("email-invalido")).toThrow("E-mail inválido");
    expect(() => new Email("email@com")).toThrow("E-mail inválido");
  });

  test("deve comparar dois e-mails iguais", () => {
    const email1 = new Email("contato@toqueaquela.com");
    const email2 = new Email("contato@toqueaquela.com");
    expect(email1.equals(email2)).toBe(true);
  });
});
