import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { AuthenticateArtistUseCase } from "./application/use-cases/authenticate-artist.use-case";
import { CreateArtistUseCase } from "./application/use-cases/create-artist.use-case";
import { FinishShowUseCase } from "./application/use-cases/finish-show.use-case";
import { GetActiveShowUseCase } from "./application/use-cases/get-active-show.use-case";
import { StartShowUseCase } from "./application/use-cases/start-show.use-case";
import { AppError } from "./core/errors/app-error";
import { DrizzleArtistRepository } from "./infra/db/repositories/drizzle-artist.repository";
import { DrizzleMusicRequestRepository } from "./infra/db/repositories/drizzle-music-request.repository";
import { DrizzleShowRepository } from "./infra/db/repositories/drizzle-show.repository";
import { artistController } from "./infra/http/controllers/artist.controller";
import { showController } from "./infra/http/controllers/show.controller";
import { authMiddleware } from "./infra/http/middlewares/auth.middleware";
import { PinoLogger } from "./infra/logger/pino-logger";
import { BunPasswordHasher } from "./infra/security/bun-password-hasher";

const logger = new PinoLogger();
const hasher = new BunPasswordHasher();
const artistRepo = new DrizzleArtistRepository();
const showRepo = new DrizzleShowRepository();
const requestRepo = new DrizzleMusicRequestRepository();
const createUC = new CreateArtistUseCase(artistRepo, hasher, logger);
const authUC = new AuthenticateArtistUseCase(artistRepo, hasher, logger);
const startShowUC = new StartShowUseCase(showRepo, artistRepo, logger);
const finishShowUC = new FinishShowUseCase(showRepo, requestRepo, logger);
const getActiveShowUC = new GetActiveShowUseCase(showRepo, logger);

const app = new Elysia()
  .use(swagger({ path: "/docs" }))
  .get("/", () => "hello")
  .group("/v1", (app) =>
    app
      .error({ AppError })
      .onError(({ code, error, set }) => {
        if (error instanceof AppError) {
          set.status = error.statusCode;
          return { code: error.code, message: error.message };
        }
        set.status = 500;
        return { code: "ERROR", message: String(error) };
      })
      .use(artistController(createUC, authUC))
      .guard(
        {
          detail: { security: [{ bearerAuth: [] }] },
        },
        (app) =>
          app.use(authMiddleware).use(showController(startShowUC, finishShowUC, getActiveShowUC))
      )
  )
  .listen(3001);

console.log("Test on http://localhost:3001/docs");
