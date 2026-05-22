import { Elysia, t } from "elysia";
import type { GetPublicShowUseCase } from "../../../application/use-cases/get-public-show.use-case";

export const publicShowController = (getPublicShowUseCase: GetPublicShowUseCase) =>
  new Elysia({ prefix: "/shows" }).get(
    "/:showId",
    async ({ params }) => {
      return getPublicShowUseCase.execute(params.showId);
    },
    {
      params: t.Object({
        showId: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Dados públicos do show (fã via QR Code)",
        tags: ["Show"],
      },
    }
  );
