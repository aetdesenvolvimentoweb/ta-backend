import { Show } from "../../core/entities/show.entity";
import { BusinessRuleError, NotFoundError } from "../../core/errors/app-error";
import type { IShowRepository } from "../../core/ports/show.repository";
import type { IArtistRepository } from "../../core/ports/artist.repository";
import type { ILogger } from "../../core/ports/logger.port";
import { ShowDuration } from "../../core/value-objects/show-duration.vo";

export interface StartShowInput {
  artistId: string;
  durationHours: number;
}

/**
 * Caso de Uso: Iniciar um novo show.
 * Aplica a regra RN01 (Apenas 1 show ativo por artista).
 */
export class StartShowUseCase {
  constructor(
    private showRepository: IShowRepository,
    private artistRepository: IArtistRepository,
    private logger: ILogger
  ) {}

  async execute(input: StartShowInput): Promise<Show> {
    // 1. Verificar se o artista existe
    const artist = await this.artistRepository.findById(input.artistId);
    if (!artist) {
      throw new NotFoundError("Artista não encontrado.");
    }

    // 2. Verificar se já existe um show ativo (RN01)
    const activeShow = await this.showRepository.findActiveByArtistId(input.artistId);
    if (activeShow) {
      // Antes de bloquear, verificamos se o show "ativo" já não expirou pelo tempo
      if (activeShow.isExpired()) {
        activeShow.status = 'expired';
        await this.showRepository.save(activeShow);
        this.logger.info(`Show ${activeShow.id} marcado como expirado automaticamente.`);
      } else {
        throw new BusinessRuleError("O artista já possui um show ativo no momento.");
      }
    }

    // 3. Criar novo show
    const duration = new ShowDuration(input.durationHours);
    const show = new Show(
      crypto.randomUUID(),
      input.artistId,
      new Date(),
      duration,
      'active'
    );

    await this.showRepository.save(show);

    return show;
  }
}
