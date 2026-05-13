import { ShowDuration } from "../value-objects/show-duration.vo";

/**
 * Representa um show/apresentação ao vivo de um artista.
 * @class Show
 */
export class Show {
  /**
   * @param {string} id - Identificador único do show.
   * @param {string} artistId - ID do artista realizando o show.
   * @param {Date} startTime - Horário de início.
   * @param {ShowDuration} duration - Duração máxima permitida (Value Object).
   * @param {'active' | 'finished' | 'expired'} status - Estado atual do show.
   */
  constructor(
    public readonly id: string,
    public readonly artistId: string,
    public readonly startTime: Date,
    public duration: ShowDuration = new ShowDuration(4),
    public status: 'active' | 'finished' | 'expired' = 'active'
  ) {}

  /**
   * Verifica se o show expirou com base na duração definida (RN01).
   * @returns {boolean}
   */
  isExpired(): boolean {
    if (this.status !== 'active') return true;
    
    const now = new Date();
    const expirationTime = new Date(this.startTime.getTime() + this.duration.toMilliseconds());
    
    return now > expirationTime;
  }

  /**
   * Encerra o show manualmente.
   */
  finish(): void {
    this.status = 'finished';
  }
}
