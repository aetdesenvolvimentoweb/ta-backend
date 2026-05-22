import { Elysia, t } from "elysia";
import type {
  CompletePaymentConnectionUseCase,
  DisconnectPaymentAccountUseCase,
  StartPaymentConnectionUseCase,
} from "../../../application/use-cases/payment-connection.use-case";
import { BusinessRuleError } from "../../../core/errors/app-error";
import { isSupportedGateway } from "../../../core/value-objects/payment-account.vo";
import { authMiddleware } from "../middlewares/auth.middleware";

export interface PaymentAccountControllerConfig {
  /** Redirect URI registrada no gateway — usada em /start e /callback. */
  redirectUri: string;
  /** Para onde mandar o navegador depois do callback (frontend). */
  frontendReturnUrl: string;
}

export const paymentAccountController = (
  startConnection: StartPaymentConnectionUseCase,
  completeConnection: CompletePaymentConnectionUseCase,
  disconnect: DisconnectPaymentAccountUseCase,
  config: PaymentAccountControllerConfig
) =>
  new Elysia({ prefix: "/payment-accounts" })
    .use(authMiddleware)

    .post(
      "/:gateway/connect",
      async ({ params, getArtistId }) => {
        if (!isSupportedGateway(params.gateway)) {
          throw new BusinessRuleError(`Gateway não suportado: ${params.gateway}`);
        }
        const artistId = await getArtistId();
        const { authorizeUrl, state } = await startConnection.execute({
          artistId,
          gateway: params.gateway,
          redirectUri: config.redirectUri,
        });
        return { authorizeUrl, state };
      },
      {
        params: t.Object({ gateway: t.String({ maxLength: 32 }) }),
        detail: {
          summary: "Inicia o OAuth Connect para vincular conta de pagamento (RN14/RN15)",
          tags: ["Payment Account"],
          security: [{ bearerAuth: [] }],
        },
      }
    )

    .delete(
      "/:gateway",
      async ({ params, getArtistId }) => {
        if (!isSupportedGateway(params.gateway)) {
          throw new BusinessRuleError(`Gateway não suportado: ${params.gateway}`);
        }
        const artistId = await getArtistId();
        await disconnect.execute({ artistId });
        return { message: "Conta de pagamento desconectada." };
      },
      {
        params: t.Object({ gateway: t.String({ maxLength: 32 }) }),
        detail: {
          summary: "Desconecta a conta de pagamento do artista",
          tags: ["Payment Account"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

/**
 * Controller PÚBLICO para o callback OAuth (sem JWT).
 * A identidade do artista é provada pelo `state` (one-shot server-issued).
 */
export const paymentCallbackController = (
  completeConnection: CompletePaymentConnectionUseCase,
  config: PaymentAccountControllerConfig
) =>
  new Elysia({ prefix: "/payment-accounts" }).get(
    "/callback",
    async ({ query, set }) => {
      if (query.error) {
        const failUrl = `${config.frontendReturnUrl}?status=error&reason=${encodeURIComponent(query.error)}`;
        set.redirect = failUrl;
        return;
      }
      if (!query.code || !query.state) {
        throw new BusinessRuleError("Parâmetros OAuth ausentes (code/state).");
      }
      const result = await completeConnection.execute({
        code: query.code,
        state: query.state,
        redirectUri: config.redirectUri,
      });
      const okUrl = `${config.frontendReturnUrl}?status=connected&gateway=${result.gateway}`;
      set.redirect = okUrl;
    },
    {
      query: t.Object({
        code: t.Optional(t.String({ maxLength: 512 })),
        state: t.Optional(t.String({ maxLength: 128 })),
        error: t.Optional(t.String({ maxLength: 128 })),
      }),
      detail: {
        summary: "Callback OAuth do gateway (público; identidade via state)",
        tags: ["Payment Account"],
      },
    }
  );
