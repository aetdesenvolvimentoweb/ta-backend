import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { AuthenticateArtistUseCase } from "./application/use-cases/authenticate-artist.use-case";
import { CreateArtistUseCase } from "./application/use-cases/create-artist.use-case";
import { FinishShowUseCase } from "./application/use-cases/finish-show.use-case";
import { GetActiveShowUseCase } from "./application/use-cases/get-active-show.use-case";
import {
  GetShowDetailsUseCase,
  GetShowHistoryUseCase,
} from "./application/use-cases/get-show-history.use-case";
import { RequestPasswordResetUseCase } from "./application/use-cases/request-password-reset.use-case";
import { ResetPasswordUseCase } from "./application/use-cases/reset-password.use-case";
import { StartShowUseCase } from "./application/use-cases/start-show.use-case";
import { AppError } from "./core/errors/app-error";
import { DrizzleArtistRepository } from "./infra/db/repositories/drizzle-artist.repository";
import { DrizzleMusicRequestRepository } from "./infra/db/repositories/drizzle-music-request.repository";
import { DrizzlePasswordResetTokenRepository } from "./infra/db/repositories/drizzle-password-reset-token.repository";
import { DrizzleShowRepository } from "./infra/db/repositories/drizzle-show.repository";
import { DrizzleSongRepository } from "./infra/db/repositories/drizzle-song.repository";
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
const songRepo = new DrizzleSongRepository();
const tokenRepo = new DrizzlePasswordResetTokenRepository();
const createUC = new CreateArtistUseCase(artistRepo, hasher, logger);
const authUC = new AuthenticateArtistUseCase(artistRepo, hasher, logger);
const requestResetUC = new RequestPasswordResetUseCase({
  artistRepository: artistRepo,
  tokenRepository: tokenRepo,
  emailService: null,
  logger,
  frontendBaseUrl: "http://localhost:5173",
  tokenTtlMin: 30,
});
const resetPasswordUC = new ResetPasswordUseCase({
  artistRepository: artistRepo,
  tokenRepository: tokenRepo,
  passwordHasher: hasher,
  logger,
});
const startShowUC = new StartShowUseCase(showRepo, artistRepo, logger);
const finishShowUC = new FinishShowUseCase(showRepo, requestRepo, logger);
const getActiveShowUC = new GetActiveShowUseCase(showRepo, logger);
const getShowHistoryUC = new GetShowHistoryUseCase(showRepo, logger);
const getShowDetailsUC = new GetShowDetailsUseCase(showRepo, requestRepo, songRepo, logger);

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
      .use(artistController(createUC, authUC, requestResetUC, resetPasswordUC))
      .guard(
        {
          detail: { security: [{ bearerAuth: [] }] },
        },
        (app) =>
          app
            .use(authMiddleware)
            .use(
              showController(
                startShowUC,
                finishShowUC,
                getActiveShowUC,
                getShowHistoryUC,
                getShowDetailsUC
              )
            )
      )
  )
  .listen(3001);

console.log("Test on http://localhost:3001/docs");
