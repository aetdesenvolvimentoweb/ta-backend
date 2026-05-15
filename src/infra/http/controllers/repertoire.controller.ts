import { Elysia, t } from "elysia";
import { authMiddleware } from "../middlewares/auth.middleware";
import { AddSongUseCase, GetRepertoireUseCase, ToggleSongAvailabilityUseCase } from "../../../application/use-cases/manage-repertoire.use-case";

export const repertoireController = (
  addSongUseCase: AddSongUseCase,
  getRepertoireUseCase: GetRepertoireUseCase,
  toggleAvailabilityUseCase: ToggleSongAvailabilityUseCase
) =>
  new Elysia({ prefix: "/songs" })
    .use(authMiddleware)

    /**
     * Listar repertório do artista autenticado
     */
    .get("/", async ({ getArtistId }) => {
      const artistId = await getArtistId();
      const songs = await getRepertoireUseCase.execute(artistId);

      return songs.map(s => ({
        id: s.id,
        title: s.title,
        originalArtist: s.originalArtist,
        styleId: s.styleId,
        isAvailable: s.isAvailable,
      }));
    }, {
      detail: {
        summary: "Listar repertório do artista",
        tags: ["Repertoire"]
      }
    })

    /**
     * Adicionar música ao repertório
     */
    .post("/", async ({ body, getArtistId }) => {
      const artistId = await getArtistId();
      const song = await addSongUseCase.execute({ ...body, artistId });

      return {
        id: song.id,
        title: song.title,
        originalArtist: song.originalArtist,
        styleId: song.styleId,
        isAvailable: song.isAvailable,
      };
    }, {
      body: t.Object({
        title: t.String({ minLength: 1 }),
        originalArtist: t.String({ minLength: 1 }),
        styleName: t.String({ minLength: 1 }),
      }),
      detail: {
        summary: "Adicionar música ao repertório",
        tags: ["Repertoire"]
      }
    })

    /**
     * Alternar disponibilidade de uma música (RN05)
     */
    .patch("/:id/availability", async ({ params, body, getArtistId }) => {
      const artistId = await getArtistId();
      await toggleAvailabilityUseCase.execute({ songId: params.id, isAvailable: body.isAvailable, artistId });
      return { message: "Disponibilidade atualizada com sucesso" };
    }, {
      params: t.Object({
        id: t.String({ format: "uuid" })
      }),
      body: t.Object({
        isAvailable: t.Boolean()
      }),
      detail: {
        summary: "Alternar disponibilidade de uma música",
        tags: ["Repertoire"]
      }
    });
