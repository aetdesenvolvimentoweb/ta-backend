import { Elysia } from "elysia";
import { authMiddleware } from "../middlewares/auth.middleware";
import type { GetArtistMetricsUseCase } from "../../../application/use-cases/get-artist-metrics.use-case";

export const metricsController = (
  getArtistMetricsUseCase: GetArtistMetricsUseCase
) =>
  new Elysia({ prefix: "/metrics" })
    .use(authMiddleware)

    .get("/me", async ({ getArtistId }) => {
      const artistId = await getArtistId();
      return await getArtistMetricsUseCase.execute(artistId);
    }, {
      detail: {
        summary: "Métricas financeiras do artista autenticado (RN02)",
        tags: ["Metrics"]
      }
    });
