import { NotFoundError } from "../../core/errors/app-error";
import type { IArtistRepository } from "../../core/ports/artist.repository";
import type { ILogger } from "../../core/ports/logger.port";

export interface ArtistProfileOutput {
  id: string;
  name: string;
  email: string;
  socials: Record<string, string>;
  canReceiveTips: boolean;
  paymentGateway?: string;
}

export class GetArtistProfileUseCase {
  constructor(
    private artistRepository: IArtistRepository,
    private logger: ILogger
  ) {}

  async execute(artistId: string): Promise<ArtistProfileOutput> {
    const artist = await this.artistRepository.findById(artistId);
    if (!artist) throw new NotFoundError("Artista não encontrado.");

    return {
      id: artist.id,
      name: artist.name,
      email: artist.email.getValue(),
      socials: artist.socials,
      canReceiveTips: artist.canReceiveTips(),
      paymentGateway: artist.paymentAccount?.gateway,
    };
  }
}

export interface UpdateArtistProfileInput {
  artistId: string;
  name?: string;
  socials?: Record<string, string>;
}

export class UpdateArtistProfileUseCase {
  constructor(
    private artistRepository: IArtistRepository,
    private logger: ILogger
  ) {}

  async execute(input: UpdateArtistProfileInput): Promise<ArtistProfileOutput> {
    const artist = await this.artistRepository.findById(input.artistId);
    if (!artist) throw new NotFoundError("Artista não encontrado.");

    if (input.name !== undefined) artist.name = input.name;
    if (input.socials !== undefined) artist.socials = input.socials;

    await this.artistRepository.save(artist);

    this.logger.info(`Perfil atualizado: ${artist.id}`);

    return {
      id: artist.id,
      name: artist.name,
      email: artist.email.getValue(),
      socials: artist.socials,
      canReceiveTips: artist.canReceiveTips(),
      paymentGateway: artist.paymentAccount?.gateway,
    };
  }
}
