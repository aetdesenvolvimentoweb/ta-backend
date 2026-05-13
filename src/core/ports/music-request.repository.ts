import { MusicRequest } from "../entities/music-request.entity";

/**
 * Interface de Repositório para a entidade MusicRequest.
 * Define o contrato para lidar com pedidos de música.
 */
export interface IMusicRequestRepository {
  /**
   * Salva um novo pedido de música.
   */
  save(request: MusicRequest): Promise<void>;

  /**
   * Busca pedidos de um show específico.
   * Deve suportar a ordenação por Valor + Chegada e agrupamento (RN02/RN03).
   */
  findByShowId(showId: string): Promise<MusicRequest[]>;

  /**
   * Busca um pedido pelo ID.
   */
  findById(id: string): Promise<MusicRequest | null>;

  /**
   * Atualiza o status de múltiplos pedidos de uma mesma música (RN03).
   */
  updateStatusBySong(showId: string, songId: string, status: MusicRequest['status']): Promise<void>;

  /**
   * Verifica quantos pedidos gratuitos um cliente já fez em um show (RN09).
   */
  countFreeRequestsByCustomer(showId: string, customerSessionId: string): Promise<number>;
}
