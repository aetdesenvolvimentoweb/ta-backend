import { Elysia, t } from "elysia";
import { authMiddleware } from "../middlewares/auth.middleware";
import { RequestMusicUseCase } from "../../../application/use-cases/request-music.use-case";
import { GetShowRequestsUseCase } from "../../../application/use-cases/get-show-requests.use-case";
import { CancelMusicRequestUseCase } from "../../../application/use-cases/cancel-request.use-case";
import { MarkSongAsPlayedUseCase } from "../../../application/use-cases/mark-song-as-played.use-case";

export const musicRequestController = (
  requestMusicUseCase: RequestMusicUseCase,
  getShowRequestsUseCase: GetShowRequestsUseCase,
  cancelMusicRequestUseCase: CancelMusicRequestUseCase,
  markSongAsPlayedUseCase: MarkSongAsPlayedUseCase
) =>
  new Elysia({ prefix: "/shows" })

    /**
     * Realizar um pedido de música — rota pública (RN09 / Fricção Zero)
     * O público acessa via QR Code sem precisar de login.
     */
    .post("/:showId/requests", async ({ params, body }) => {
      const request = await requestMusicUseCase.execute({
        showId: params.showId,
        songId: body.songId,
        customerName: body.customerName,
        customerSessionId: body.customerSessionId,
        message: body.message,
        tipAmountInCents: body.tipAmountInCents,
      });

      return {
        id: request.id,
        songId: request.songId,
        customerName: request.customerName,
        tipAmountInCents: request.tip.amountInCents,
        status: request.status,
      };
    }, {
      params: t.Object({
        showId: t.String({ format: "uuid" })
      }),
      body: t.Object({
        songId: t.String({ format: "uuid" }),
        customerName: t.String({ minLength: 1 }),
        customerSessionId: t.String({ minLength: 1 }),
        message: t.Optional(t.String()),
        tipAmountInCents: t.Integer({ minimum: 0 }),
      }),
      detail: {
        summary: "Realizar pedido de música (público)",
        tags: ["Music Request"]
      }
    })

    /**
     * Rotas protegidas — apenas o artista autenticado acessa
     */
    .use(authMiddleware)

    /**
     * Listar pedidos do show para o painel do artista (RN02)
     */
    .get("/:showId/requests", async ({ params, getArtistId }) => {
      await getArtistId();
      const requests = await getShowRequestsUseCase.execute(params.showId);

      return requests.map(r => ({
        id: r.id,
        songId: r.songId,
        customerName: r.customerName,
        message: r.message,
        tipAmountInCents: r.tip.amountInCents,
        status: r.status,
        createdAt: r.createdAt,
      }));
    }, {
      params: t.Object({
        showId: t.String({ format: "uuid" })
      }),
      detail: {
        summary: "Listar pedidos do show (artista)",
        tags: ["Music Request"]
      }
    })

    /**
     * Marcar música como tocada — encerra todos os pedidos daquela música (RN03)
     */
    .patch("/:showId/songs/:songId/play", async ({ params, getArtistId }) => {
      await getArtistId();
      await markSongAsPlayedUseCase.execute({ showId: params.showId, songId: params.songId });
      return { message: "Música marcada como tocada" };
    }, {
      params: t.Object({
        showId: t.String({ format: "uuid" }),
        songId: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Marcar música como tocada (RN03)",
        tags: ["Music Request"]
      }
    })

    /**
     * Cancelar um pedido específico (RN05)
     */
    .patch("/:showId/requests/:requestId/cancel", async ({ params, getArtistId }) => {
      await getArtistId();
      await cancelMusicRequestUseCase.execute(params.requestId);
      return { message: "Pedido cancelado com sucesso" };
    }, {
      params: t.Object({
        showId: t.String({ format: "uuid" }),
        requestId: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Cancelar um pedido de música (RN05)",
        tags: ["Music Request"]
      }
    });
