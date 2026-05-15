import { env } from './infra/config/env'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { AppError } from './core/errors/app-error'
import { PinoLogger } from './infra/logger/pino-logger'
import { DrizzleArtistRepository } from './infra/db/repositories/drizzle-artist.repository'
import { DrizzleShowRepository } from './infra/db/repositories/drizzle-show.repository'
import { DrizzleMusicRequestRepository } from './infra/db/repositories/drizzle-music-request.repository'
import { DrizzleSongRepository } from './infra/db/repositories/drizzle-song.repository'
import { DrizzleStyleRepository } from './infra/db/repositories/drizzle-style.repository'
import { DrizzleAdminWhitelistRepository } from './infra/db/repositories/drizzle-admin-whitelist.repository'
import { BunPasswordHasher } from './infra/security/bun-password-hasher'
import { BasicProfanityFilter } from './infra/security/basic-profanity-filter'

// Use Cases
import { CreateArtistUseCase } from './application/use-cases/create-artist.use-case'
import { AuthenticateArtistUseCase } from './application/use-cases/authenticate-artist.use-case'
import { StartShowUseCase } from './application/use-cases/start-show.use-case'
import { FinishShowUseCase } from './application/use-cases/finish-show.use-case'
import { AddSongUseCase, GetRepertoireUseCase, ToggleSongAvailabilityUseCase } from './application/use-cases/manage-repertoire.use-case'
import { RequestMusicUseCase } from './application/use-cases/request-music.use-case'
import { GetShowRequestsUseCase } from './application/use-cases/get-show-requests.use-case'
import { CancelMusicRequestUseCase } from './application/use-cases/cancel-request.use-case'
import { MarkSongAsPlayedUseCase } from './application/use-cases/mark-song-as-played.use-case'
import { CreateStyleUseCase, MergeStylesUseCase } from './application/use-cases/admin-styles.use-case'
import { ValidateAdminWhitelistUseCase } from './application/use-cases/admin-whitelist.use-case'
import { GetAppMetricsUseCase } from './application/use-cases/get-app-metrics.use-case'
import { GetArtistMetricsUseCase } from './application/use-cases/get-artist-metrics.use-case'

// Controllers
import { artistController } from './infra/http/controllers/artist.controller'
import { showController } from './infra/http/controllers/show.controller'
import { repertoireController } from './infra/http/controllers/repertoire.controller'
import { musicRequestController } from './infra/http/controllers/music-request.controller'
import { adminController } from './infra/http/controllers/admin.controller'
import { metricsController } from './infra/http/controllers/metrics.controller'

// Middlewares
import { rateLimit } from './infra/http/middlewares/rate-limit.middleware'
import { securityHeaders } from './infra/http/middlewares/security-headers.middleware'

// 1. Infra
const logger = new PinoLogger()
const passwordHasher = new BunPasswordHasher()
const profanityFilter = new BasicProfanityFilter()
const artistRepository = new DrizzleArtistRepository()
const showRepository = new DrizzleShowRepository()
const requestRepository = new DrizzleMusicRequestRepository()
const songRepository = new DrizzleSongRepository()
const styleRepository = new DrizzleStyleRepository()
const whitelistRepository = new DrizzleAdminWhitelistRepository(env.ADMIN_WHITELIST)

// 2. Use Cases
const createArtistUseCase = new CreateArtistUseCase(artistRepository, passwordHasher, logger)
const authenticateArtistUseCase = new AuthenticateArtistUseCase(artistRepository, passwordHasher, logger)
const startShowUseCase = new StartShowUseCase(showRepository, artistRepository, logger)
const finishShowUseCase = new FinishShowUseCase(showRepository, requestRepository, logger)
const addSongUseCase = new AddSongUseCase(songRepository, styleRepository, logger)
const getRepertoireUseCase = new GetRepertoireUseCase(songRepository, logger)
const toggleAvailabilityUseCase = new ToggleSongAvailabilityUseCase(songRepository, logger)
const requestMusicUseCase = new RequestMusicUseCase(requestRepository, showRepository, songRepository, artistRepository, logger, profanityFilter)
const getShowRequestsUseCase = new GetShowRequestsUseCase(requestRepository, showRepository, logger)
const cancelMusicRequestUseCase = new CancelMusicRequestUseCase(requestRepository, showRepository, logger)
const markSongAsPlayedUseCase = new MarkSongAsPlayedUseCase(requestRepository, showRepository, logger)
const createStyleUseCase = new CreateStyleUseCase(styleRepository, logger)
const mergeStylesUseCase = new MergeStylesUseCase(styleRepository, logger)
const validateAdminWhitelistUseCase = new ValidateAdminWhitelistUseCase(whitelistRepository, logger)
const getAppMetricsUseCase = new GetAppMetricsUseCase(requestRepository, artistRepository, songRepository, logger)
const getArtistMetricsUseCase = new GetArtistMetricsUseCase(requestRepository, showRepository, logger)

// 3. Rotas v1
const v1Router = new Elysia({ prefix: '/v1' })
  .error({ AppError })
  .onError(({ code, error, set }) => {
    if (error instanceof AppError) {
      logger.warn(`Erro de negócio: ${error.message}`, { code: error.code })
      set.status = error.statusCode
      return { code: error.code, message: error.message }
    }

    if (code === 'NOT_FOUND') {
      set.status = 404
      return { code: 'NOT_FOUND', message: 'A rota solicitada não foi encontrada.' }
    }

    if (code === 'VALIDATION') {
      set.status = 400
      return {
        code: 'VALIDATION_ERROR',
        message: 'Os dados enviados são inválidos.',
        errors: error.all
      }
    }

    logger.error('Erro interno não tratado', error)
    set.status = 500
    return { code: 'INTERNAL_SERVER_ERROR', message: 'Ocorreu um erro interno inesperado.' }
  })
  // Públicas
  .use(artistController(createArtistUseCase, authenticateArtistUseCase))
  .use(musicRequestController(requestMusicUseCase, getShowRequestsUseCase, cancelMusicRequestUseCase, markSongAsPlayedUseCase))
  // Protegidas por JWT
  .guard({ detail: { security: [{ bearerAuth: [] }] } }, (app) =>
    app
      .use(showController(startShowUseCase, finishShowUseCase))
      .use(repertoireController(addSongUseCase, getRepertoireUseCase, toggleAvailabilityUseCase))
      .use(metricsController(getArtistMetricsUseCase))
  )
  // Admin (whitelist + JWT)
  .use(adminController(
    validateAdminWhitelistUseCase,
    createStyleUseCase,
    mergeStylesUseCase,
    getAppMetricsUseCase
  ))

// 4. App
const app = new Elysia()
  .use(securityHeaders)
  .use(cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map(s => s.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  }))
  .use(rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_REQUESTS,
  }))
  .use(swagger({
    path: '/docs',
    documentation: {
      info: {
        title: 'Toque Aquela API',
        description: 'Documentação da API para a plataforma Toque Aquela',
        version: '0.1.0'
      },
      tags: [
        { name: 'Artist', description: 'Gerenciamento de artistas' },
        { name: 'Show', description: 'Ciclo de vida de apresentações ao vivo' },
        { name: 'Repertoire', description: 'Gestão do repertório de músicas do artista' },
        { name: 'Music Request', description: 'Pedidos de músicas pelo público (Fricção Zero)' },
        { name: 'Metrics', description: 'Métricas financeiras do artista' },
        { name: 'Admin', description: 'Painel administrativo (whitelist)' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
        }
      }
    }
  }))

  .get('/', () => ({
    status: 'online',
    message: 'Toque Aquela API is running!',
    version: '0.1.0',
    docs: '/docs'
  }))

  .use(v1Router)

  .listen(env.PORT)

logger.info(`🚀 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
