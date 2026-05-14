import { expect, test, describe } from "bun:test";
import { GetShowRequestsUseCase } from "./get-show-requests.use-case";
import { MusicRequest } from "../../core/entities/music-request.entity";
import { Money } from "../../core/value-objects/money.vo";

class MockRequestRepo {
  private requests: MusicRequest[] = [];
  
  constructor(initialRequests: MusicRequest[] = []) {
    this.requests = initialRequests;
  }

  async findByShowId(showId: string) {
    return this.requests.filter(r => r.showId === showId);
  }
  async save() {}
  async countFreeRequestsByCustomer() { return 0; }
  async findById() { return null; }
  async updateStatusBySong() {}
}

const mockLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };

describe("GetShowRequests Use Case (RN02)", () => {
  test("deve ordenar pedidos por gorjeta (maior primeiro) e depois por chegada", async () => {
    const now = Date.now();
    
    const req1 = new MusicRequest("1", "show-1", "s1", "A", null, null, new Money(1000), 'pending', new Date(now));
    const req2 = new MusicRequest("2", "show-1", "s2", "B", null, null, new Money(2000), 'pending', new Date(now + 1000));
    const req3 = new MusicRequest("3", "show-1", "s3", "C", null, null, new Money(1000), 'pending', new Date(now - 1000));

    // Ordem de inserção bagunçada
    const repo = new MockRequestRepo([req1, req2, req3]);
    const useCase = new GetShowRequestsUseCase(repo as any, mockLogger as any);

    const sorted = await useCase.execute("show-1");

    // Esperado: 
    // 1. req2 (R$ 20,00)
    // 2. req3 (R$ 10,00 - mais antigo que req1)
    // 3. req1 (R$ 10,00 - mais recente)
    expect(sorted[0]!.id).toBe("2");
    expect(sorted[1]!.id).toBe("3");
    expect(sorted[2]!.id).toBe("1");
  });
});
