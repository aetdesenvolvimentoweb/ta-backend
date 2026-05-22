import type { Show } from "../../core/entities/show.entity";
import type { ILogger } from "../../core/ports/logger.port";
import type { IShowRepository } from "../../core/ports/show.repository";

export class GetActiveShowUseCase {
  constructor(
    private showRepository: IShowRepository,
    private logger: ILogger
  ) {}

  async execute(artistId: string): Promise<Show | null> {
    return this.showRepository.findActiveByArtistId(artistId);
  }
}
