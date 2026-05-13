import { Artist } from "../entities/artist.entity";

/**
 * Interface de Repositório para a entidade Artist.
 * Define o contrato de persistência para artistas.
 */
export interface IArtistRepository {
  /**
   * Salva um novo artista ou atualiza um existente.
   */
  save(artist: Artist): Promise<void>;

  /**
   * Busca um artista pelo ID único.
   */
  findById(id: string): Promise<Artist | null>;

  /**
   * Busca um artista pelo e-mail.
   */
  findByEmail(email: string): Promise<Artist | null>;

  /**
   * Remove um artista do sistema.
   */
  delete(id: string): Promise<void>;
}
