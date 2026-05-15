import { Elysia, t } from "elysia";
import { authMiddleware } from "../middlewares/auth.middleware";
import { RequestMusicUseCase } from "../../../application/use-cases/request-music.use-case";
import { GetShowRequestsUseCase } from "../../../application/use-cases/get-show-requests.use-case";
import { CancelMusicRequestUseCase } from "../../../application/use-cases/cancel-request.use-case";
import { MarkSongAsPlayedUseCase } from "../../../application/use-cases/mark-song-as-played.use-case";
import { CreateTipPaymentUseCase } from "../../../application/use-cases/tip-payment.use-case";

const COOKIE_NAME = "customer_sid";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const musicRequestController = (
  requestMusicUseCase: RequestMusicUseCase,
  getShowRequestsUseCase: GetShowRequestsUseCase,
  cancelMusicRequestUseCase: CancelMusicRequestUseCase,
  markSongAsPlayedUseCase: MarkSongAsPlayedUseCase,
  createTipPaymentUseCase?: CreateTipPaymentUseCase,
) =>
  new Elysia({
    prefix: "/shows",
    cookie: {
      secrets: process.env.COOKIE_SECRET!,
      sign: [COOKIE_NAME]
    }
  })

    /**
     * Realizar um pedido de música — rota pública (RN09 / Fricção Zero).
     * A identidade da sessão é emitida pelo servidor via cookie HttpOnly assinado,
     * impedindo que o cliente forje sessões para burlar o limite de pedidos grátis.
     */
    .post("/:showId/requests", async ({ params, body, cookie: { customer_sid } }) => {
      let sid = customer_sid.value;

      if (!sid) {
        sid = crypto.randomUUID();
        customer_sid.set({
          value: sid,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: ONE_YEAR_SECONDS,
          path: '/'
        });
      }

      const request = await requestMusicUseCase.execute({
        showId: params.showId,
        songId: body.songId,
        customerName: body.customerName,
        customerSessionId: sid,
        message: body.message,
        tipAmountInCents: body.tipAmountInCents,
      });

      let paymentInfo: { checkoutUrl?: string } | undefined;
      if (body.tipAmountInCents > 0 && createTipPaymentUseCase) {
        const tipResult = await createTipPaymentUseCase.execute({ musicRequestId: request.id });
        if (tipResult.checkoutUrl) {
          paymentInfo = { checkoutUrl: tipResult.checkoutUrl };
        }
      }

      return {
        id: request.id,
        songId: request.songId,
        customerName: request.customerName,
        tipAmountInCents: request.tip.amountInCents,
        status: request.status,
        ...(paymentInfo ? { payment: paymentInfo } : {}),
      };
    }, {
      params: t.Object({
        showId: t.String({ format: "uuid" })
      }),
      body: t.Object({
        songId: t.String({ format: "uuid" }),
        customerName: t.String({ minLength: 1, maxLength: 60 }),
        message: t.Optional(t.String({ maxLength: 280 })),
        tipAmountInCents: t.Integer({ minimum: 0, maximum: 1_000_000 }),
      }),
      cookie: t.Cookie({
        customer_sid: t.Optional(t.String())
      }),
      detail: {
        summary: "Realizar pedido de música (público)",
        tags: ["Music Request"]
      }
    })

    /**
     * Rotas protegidas — apenas o artista autenticado dono do show acessa.
     */
    .use(authMiddleware)

    .get("/:showId/requests", async ({ params, getArtistId }) => {
      const artistId = await getArtistId();
      const requests = await getShowRequestsUseCase.execute({ showId: params.showId, artistId });

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

    .patch("/:showId/songs/:songId/play", async ({ params, getArtistId }) => {
      const artistId = await getArtistId();
      await markSongAsPlayedUseCase.execute({ showId: params.showId, songId: params.songId, artistId });
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

    .patch("/:showId/requests/:requestId/cancel", async ({ params, getArtistId }) => {
      const artistId = await getArtistId();
      await cancelMusicRequestUseCase.execute({ requestId: params.requestId, artistId });
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
