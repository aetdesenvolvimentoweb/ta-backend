import type { Show } from "../entities/show.entity";

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
}
