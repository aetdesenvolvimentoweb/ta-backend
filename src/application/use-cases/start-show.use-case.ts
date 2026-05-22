import { Show } from "../../core/entities/show.entity";
import { BusinessRuleError, NotFoundError } from "../../core/errors/app-error";
import type { IArtistRepository } from "../../core/ports/artist.repository";
import type { ILogger } from "../../core/ports/logger.port";
import type { IShowRepository } from "../../core/ports/show.repository";
import { ShowDuration } from "../../core/value-objects/show-duration.vo";

export interface StartShowInput {
  artistId: string;
  durationHours: number;
  scheduledStartTime?: Date;
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
        activeShow.status = "expired";
        await this.showRepository.save(activeShow);
        this.logger.info(`Show ${activeShow.id} marcado como expirado automaticamente.`);
      } else {
        throw new BusinessRuleError("O artista já possui um show ativo no momento.");
      }
    }

    // 3. Criar novo show
    const duration = new ShowDuration(input.durationHours);

    const MAX_SCHEDULE_AHEAD_MS = 24 * 60 * 60 * 1000;
    let startTime = new Date();
    if (input.scheduledStartTime) {
      const diff = input.scheduledStartTime.getTime() - startTime.getTime();
      if (diff <= 0) throw new BusinessRuleError("O horário de início deve ser no futuro.");
      if (diff > MAX_SCHEDULE_AHEAD_MS)
        throw new BusinessRuleError(
          "O show não pode ser agendado com mais de 24 horas de antecedência."
        );
      startTime = input.scheduledStartTime;
    }

    const show = new Show(crypto.randomUUID(), input.artistId, startTime, duration, "active");

    await this.showRepository.save(show);

    return show;
  }
}
