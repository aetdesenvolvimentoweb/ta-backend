/**
 * Representa um pedido de música feito pelo público.
 * @class MusicRequest
 */
export class MusicRequest {
  /**
   * @param {string} id - Identificador único do pedido.
   * @param {string} showId - ID do show onde o pedido foi feito.
   * @param {string} songId - ID da música solicitada.
   * @param {string} customerName - Nome/Apelido de quem pediu (Fricção Zero).
   * @param {string | null} message - Mensagem ou dedicatória (Opcional).
   * @param {number} tipAmount - Valor da gorjeta oferecida (0 para gratuito).
   * @param {'pending' | 'played' | 'cancelled' | 'refunded'} status - Status do pedido.
   * @param {Date} createdAt - Data/Hora da criação do pedido.
   */
  constructor(
    public readonly id: string,
    public readonly showId: string,
    public readonly songId: string,
    public customerName: string,
    public message: string | null = null,
    public tipAmount: number = 0,
    public status: 'pending' | 'played' | 'cancelled' | 'refunded' = 'pending',
    public readonly createdAt: Date = new Date()
  ) {}

  /**
   * Marca o pedido como atendido/tocado (RN03).
   */
  markAsPlayed(): void {
    this.status = 'played';
  }

  /**
   * Cancela o pedido, possibilitando estorno futuro (RN05).
   */
  cancel(): void {
    this.status = 'cancelled';
  }
}
