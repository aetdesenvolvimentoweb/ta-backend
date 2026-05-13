/**
 * Representa um show/apresentação ao vivo de um artista.
 * @class Show
 */
export class Show {
  /**
   * @param {string} id - Identificador único do show.
   * @param {string} artistId - ID do artista realizando o show.
   * @param {Date} startTime - Horário de início.
   * @param {number} durationHours - Duração máxima permitida em horas (RN01).
   * @param {'active' | 'finished' | 'expired'} status - Estado atual do show.
   */
  constructor(
    public readonly id: string,
    public readonly artistId: string,
    public readonly startTime: Date,
    public durationHours: number = 4,
    public status: 'active' | 'finished' | 'expired' = 'active'
  ) {}

  /**
   * Verifica se o show expirou com base na duração definida (RN01).
   * @returns {boolean}
   */
  isExpired(): boolean {
    if (this.status !== 'active') return true;
    
    const now = new Date();
    const expirationTime = new Date(this.startTime.getTime() + this.durationHours * 60 * 60 * 1000);
    
    return now > expirationTime;
  }

  /**
   * Encerra o show manualmente.
   */
  finish(): void {
    this.status = 'finished';
  }
}
