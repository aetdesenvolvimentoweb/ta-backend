import { Elysia, t } from "elysia";
import type { FinishShowUseCase } from "../../../application/use-cases/finish-show.use-case";
import type { GetActiveShowUseCase } from "../../../application/use-cases/get-active-show.use-case";
import type { StartShowUseCase } from "../../../application/use-cases/start-show.use-case";
import { authMiddleware } from "../middlewares/auth.middleware";

export const showController = (
  startShowUseCase: StartShowUseCase,
  finishShowUseCase: FinishShowUseCase,
  getActiveShowUseCase: GetActiveShowUseCase
) =>
  new Elysia({ prefix: "/shows" })
    .use(authMiddleware)

    /**
     * Obter o show ativo do artista autenticado. Retorna null se não houver show ativo.
     */
    .get(
      "/me",
      async ({ getArtistId }) => {
        const artistId = await getArtistId();
        const show = await getActiveShowUseCase.execute(artistId);
        if (!show) return null;
        return {
          id: show.id,
          artistId: show.artistId,
          startTime: show.startTime,
          durationHours: show.duration.hours,
          status: show.status,
        };
      },
      {
        detail: {
          summary: "Obter show ativo do artista autenticado",
          tags: ["Show"],
        },
      }
    )

    /**
     * Iniciar um novo show
     */
    .post(
      "/",
      async ({ body, getArtistId }) => {
        const artistId = await getArtistId();

        const show = await startShowUseCase.execute({
          artistId,
          durationHours: body.durationHours,
          scheduledStartTime: body.scheduledStartTime
            ? new Date(body.scheduledStartTime)
            : undefined,
        });

        return {
          id: show.id,
          artistId: show.artistId,
          startTime: show.startTime,
          durationHours: show.duration.hours,
          status: show.status,
        };
      },
      {
        body: t.Object({
          durationHours: t.Integer({ minimum: 1, maximum: 24 }),
          scheduledStartTime: t.Optional(t.String()),
        }),
        detail: {
          summary: "Iniciar um novo show",
          tags: ["Show"],
        },
      }
    )

    /**
     * Finalizar um show
     */
    .post(
      "/:showId/finish",
      async ({ params, getArtistId }) => {
        const artistId = await getArtistId();
        await finishShowUseCase.execute({ showId: params.showId, artistId });
        return { message: "Show finalizado com sucesso" };
      },
      {
        params: t.Object({
          showId: t.String({ format: "uuid" }),
        }),
        detail: {
          summary: "Finalizar um show manualmente",
          tags: ["Show"],
        },
      }
    );
