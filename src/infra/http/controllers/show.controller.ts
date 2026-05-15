import { Elysia, t } from "elysia";
import { authMiddleware } from "../middlewares/auth.middleware";
import { StartShowUseCase } from "../../../application/use-cases/start-show.use-case";
import { FinishShowUseCase } from "../../../application/use-cases/finish-show.use-case";

export const showController = (
  startShowUseCase: StartShowUseCase,
  finishShowUseCase: FinishShowUseCase
) => 
  new Elysia({ prefix: "/shows" })
    .use(authMiddleware)
    /**
     * Iniciar um novo show
     */
    .post("/", async ({ body, getArtistId }) => {
      const artistId = await getArtistId();
      
      const show = await startShowUseCase.execute({
        ...body,
        artistId // Sobrescreve ou garante que o artistId vem do token
      });

      return {
        id: show.id,
        artistId: show.artistId,
        startTime: show.startTime,
        durationHours: show.duration.hours,
        status: show.status
      };
    }, {
      body: t.Object({
        durationHours: t.Integer({ minimum: 1, maximum: 24 })
      }),
      detail: {
        summary: "Iniciar um novo show",
        tags: ["Show"]
      }
    })

    /**
     * Finalizar um show
     */
    .post("/:id/finish", async ({ params, getArtistId }) => {
      const artistId = await getArtistId();
      await finishShowUseCase.execute({ showId: params.id, artistId });
      return { message: "Show finalizado com sucesso" };
    }, {
      params: t.Object({
        id: t.String({ format: "uuid" })
      }),
      detail: {
        summary: "Finalizar um show manualmente",
        tags: ["Show"]
      }
    });
