import type { Show } from "../entities/show.entity";

/**
 * Snapshot de um show histórico com métricas agregadas (apenas pedidos `played`).
 */
export interface ShowWithStats {
  show: Show;
  totalRequests: number;
  totalPlayed: number;
  totalTipsGrossCents: number;
}

/**
 * Interface de Repositório para a entidade Show.
 * Define como os shows são persistidos e consultados.
 */
export interface IShowRepository {
  /**
   * Salva um show e garante a regra de apenas um show ativo por artista (RN01).
   */
  save(show: Show): Promise<void>;

  /**
   * Busca um show pelo ID.
   */
  findById(id: string): Promise<Show | null>;

  /**
   * Busca o show atualmente ativo de um artista.
   */
  findActiveByArtistId(artistId: string): Promise<Show | null>;

  /**
   * Lista todos os shows (Útil para o Administrador).
   */
  findAll(): Promise<Show[]>;

  /**
   * Atualiza o status de shows expirados (RN01).
   */
  markExpiredShows(): Promise<void>;

  /**
   * Histórico de shows encerrados/expirados de um artista, ordenados por data desc,
   * com métricas agregadas (totais de pedidos, pedidos tocados e arrecadação bruta).
   */
  findHistoryByArtistId(artistId: string, limit?: number): Promise<ShowWithStats[]>;
}
