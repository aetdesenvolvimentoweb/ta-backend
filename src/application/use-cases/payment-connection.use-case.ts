import { NotFoundError, UnauthorizedError } from "../../core/errors/app-error";
import type { IArtistRepository } from "../../core/ports/artist.repository";
import type { ILogger } from "../../core/ports/logger.port";
import type { IPaymentCredentialsRepository } from "../../core/ports/payment-credentials.repository";
import type { IPaymentGatewayRegistry } from "../../core/ports/payment-gateway.port";
import {
  PaymentAccount,
  type PaymentGatewayName,
} from "../../core/value-objects/payment-account.vo";
import type { IOAuthStateStore } from "../../infra/security/oauth-state-store";
import {
  deriveCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
} from "../../infra/security/pkce";

export interface StartPaymentConnectionInput {
  artistId: string;
  gateway: PaymentGatewayName;
  redirectUri: string;
}

export interface StartPaymentConnectionOutput {
  authorizeUrl: string;
  state: string;
}

/**
 * Inicia o fluxo OAuth Connect: gera state + PKCE, persiste no store e devolve a URL de autorização.
 * O frontend redireciona o navegador do artista para essa URL.
 */
export class StartPaymentConnectionUseCase {
  constructor(
    private readonly artistRepository: IArtistRepository,
    private readonly registry: IPaymentGatewayRegistry,
    private readonly stateStore: IOAuthStateStore,
    private readonly logger: ILogger
  ) {}

  async execute(input: StartPaymentConnectionInput): Promise<StartPaymentConnectionOutput> {
    const artist = await this.artistRepository.findById(input.artistId);
    if (!artist) throw new NotFoundError("Artista não encontrado.");

    const gateway = this.registry.get(input.gateway);
    const state = generateOAuthState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await deriveCodeChallenge(codeVerifier);

    this.stateStore.put(state, {
      artistId: artist.id,
      gateway: input.gateway,
      codeVerifier,
    });

    const authorizeUrl = gateway.buildAuthorizeUrl({
      state,
      redirectUri: input.redirectUri,
      codeChallenge,
    });

    this.logger.info(`OAuth iniciado: artist=${artist.id} gateway=${input.gateway}`);
    return { authorizeUrl, state };
  }
}

export interface CompletePaymentConnectionInput {
  code: string;
  state: string;
  redirectUri: string;
}

export interface CompletePaymentConnectionOutput {
  artistId: string;
  gateway: PaymentGatewayName;
  externalAccountId: string;
}

/**
 * Conclui o fluxo OAuth: valida `state`, troca `code` por tokens, persiste credenciais
 * criptografadas e atualiza o artista com `paymentAccount`.
 */
export class CompletePaymentConnectionUseCase {
  constructor(
    private readonly artistRepository: IArtistRepository,
    private readonly credentialsRepository: IPaymentCredentialsRepository,
    private readonly registry: IPaymentGatewayRegistry,
    private readonly stateStore: IOAuthStateStore,
    private readonly logger: ILogger
  ) {}

  async execute(input: CompletePaymentConnectionInput): Promise<CompletePaymentConnectionOutput> {
    const entry = this.stateStore.consume(input.state);
    const gatewayName = entry.gateway as PaymentGatewayName;
    const gateway = this.registry.get(gatewayName);

    const credentials = await gateway.exchangeOAuthCode({
      code: input.code,
      redirectUri: input.redirectUri,
      codeVerifier: entry.codeVerifier,
    });

    const artist = await this.artistRepository.findById(entry.artistId);
    if (!artist) {
      this.logger.warn(`Callback OAuth para artista inexistente: ${entry.artistId}`);
      throw new UnauthorizedError("Sessão OAuth inválida.");
    }

    artist.connectPaymentAccount(new PaymentAccount(gatewayName, credentials.externalAccountId));
    await this.artistRepository.save(artist);

    await this.credentialsRepository.save({
      artistId: artist.id,
      gateway: gatewayName,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      expiresAt: credentials.expiresAt,
    });

    this.logger.info(
      `OAuth concluído: artist=${artist.id} gateway=${gatewayName} extAccount=${credentials.externalAccountId}`
    );

    return {
      artistId: artist.id,
      gateway: gatewayName,
      externalAccountId: credentials.externalAccountId,
    };
  }
}

export interface DisconnectPaymentAccountInput {
  artistId: string;
}

/**
 * Desconecta a conta de pagamento: limpa credenciais e o `paymentAccount` do artista.
 * Idempotente — sem erro se já estiver desconectada.
 */
export class DisconnectPaymentAccountUseCase {
  constructor(
    private readonly artistRepository: IArtistRepository,
    private readonly credentialsRepository: IPaymentCredentialsRepository,
    private readonly logger: ILogger
  ) {}

  async execute(input: DisconnectPaymentAccountInput): Promise<void> {
    const artist = await this.artistRepository.findById(input.artistId);
    if (!artist) throw new NotFoundError("Artista não encontrado.");

    artist.disconnectPaymentAccount();
    await this.artistRepository.save(artist);
    await this.credentialsRepository.deleteByArtistId(artist.id);

    this.logger.info(`Conta de pagamento desconectada: artist=${artist.id}`);
  }
}
