import { expect, test, describe } from "bun:test";
import { Artist } from "./artist.entity";
import { MusicRequest } from "./music-request.entity";
import { Email } from "../value-objects/email.vo";
import { Money } from "../value-objects/money.vo";
import { BusinessRuleError, NotFoundError, UnauthorizedError } from "../errors/app-error";

describe("Domain Coverage (Edge Cases)", () => {
  test("Artist: deve atualizar socials e status premium", () => {
    const artist = new Artist("1", "João", new Email("joao@teste.com"));
    
    artist.updateSocials({ instagram: "@joao" });
    expect(artist.socials.instagram).toBe("@joao");

    artist.setPremiumStatus(true);
    expect(artist.isPremium).toBe(true);
  });

  test("MusicRequest: deve alterar status via métodos da entidade", () => {
    const request = new MusicRequest("1", "show-1", "song-1", "André");
    
    request.markAsPlayed();
    expect(request.status).toBe('played');

    request.cancel();
    expect(request.status).toBe('cancelled');
  });

  test("Money: deve subtrair valores e validar inteiros", () => {
    const m1 = new Money(1000);
    const m2 = new Money(400);
    
    const result = m1.subtract(m2);
    expect(result.amountInCents).toBe(600);

    // Teste de erro para não inteiro
    expect(() => new Money(10.5)).toThrow("deve ser um número inteiro");
  });

  test("AppErrors: deve retornar os status codes corretos", () => {
    const brError = new BusinessRuleError("erro");
    const nfError = new NotFoundError("erro");
    const unError = new UnauthorizedError("erro");

    expect(brError.statusCode).toBe(400);
    expect(nfError.statusCode).toBe(404);
    expect(unError.statusCode).toBe(401);
  });
});
