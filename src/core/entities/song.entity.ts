/**
 * Representa uma música no repertório de um artista.
 * @class Song
 */
export class Song {
  /**
   * @param {string} id - Identificador único da música.
   * @param {string} artistId - ID do artista proprietário desta música no repertório.
   * @param {string} title - Título da música.
   * @param {string} originalArtist - Nome do artista original/compositor.
   * @param {string} styleId - ID do estilo musical (referência à entidade Style).
   * @param {boolean} isAvailable - Define se a música pode ser pedida no momento (RN05).
   */
  constructor(
    public readonly id: string,
    public readonly artistId: string,
    public title: string,
    public originalArtist: string,
    public styleId: string | undefined,
    public isAvailable: boolean = true
  ) {}

  /**
   * Alterna a disponibilidade da música para pedidos (RN05).
   * @param {boolean} available - Status de disponibilidade.
   */
  setAvailability(available: boolean): void {
    this.isAvailable = available;
  }
}
