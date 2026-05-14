import { swagger } from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import { AppError } from './core/errors/app-error'
import { PinoLogger } from './infra/logger/pino-logger'
import { DrizzleArtistRepository } from './infra/db/repositories/drizzle-artist.repository'
import { DrizzleShowRepository } from './infra/db/repositories/drizzle-show.repository'
import { DrizzleMusicRequestRepository } from './infra/db/repositories/drizzle-music-request.repository'
import { DrizzleSongRepository } from './infra/db/repositories/drizzle-song.repository'
import { DrizzleStyleRepository } from './infra/db/repositories/drizzle-style.repository'
import { BunPasswordHasher } from './infra/security/bun-password-hasher'

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

// Controllers
import { artistController } from './infra/http/controllers/artist.controller'
import { showController } from './infra/http/controllers/show.controller'
import { repertoireController } from './infra/http/controllers/repertoire.controller'
import { musicRequestController } from './infra/http/controllers/music-request.controller'


// 1. Instanciar Infra
const logger = new PinoLogger()
const passwordHasher = new BunPasswordHasher()
const artistRepository = new DrizzleArtistRepository()
const showRepository = new DrizzleShowRepository()
const requestRepository = new DrizzleMusicRequestRepository()
const songRepository = new DrizzleSongRepository()
const styleRepository = new DrizzleStyleRepository()

// 2. Instanciar Use Cases
const createArtistUseCase = new CreateArtistUseCase(artistRepository, passwordHasher, logger)
const authenticateArtistUseCase = new AuthenticateArtistUseCase(artistRepository, passwordHasher, logger)
const startShowUseCase = new StartShowUseCase(showRepository, artistRepository, logger)
const finishShowUseCase = new FinishShowUseCase(showRepository, requestRepository, logger)
const addSongUseCase = new AddSongUseCase(songRepository, styleRepository, logger)
const getRepertoireUseCase = new GetRepertoireUseCase(songRepository, logger)
const toggleAvailabilityUseCase = new ToggleSongAvailabilityUseCase(songRepository, logger)
const requestMusicUseCase = new RequestMusicUseCase(requestRepository, showRepository, songRepository, logger)
const getShowRequestsUseCase = new GetShowRequestsUseCase(requestRepository, logger)
const cancelMusicRequestUseCase = new CancelMusicRequestUseCase(requestRepository, logger)
const markSongAsPlayedUseCase = new MarkSongAsPlayedUseCase(requestRepository, logger)

// 3. Configurar Rotas v1 (instância separada para compatibilidade com Swagger)
const v1Router = new Elysia({ prefix: '/v1' })
  .error({ AppError })
  .onError(({ code, error, set }) => {
    if (error instanceof AppError) {
      logger.warn(`Erro de negócio: ${error.message}`, { code: error.code })
      set.status = error.statusCode
      return {
        code: error.code,
        message: error.message
      }
    }

    if (code === 'NOT_FOUND') {
      set.status = 404
      return {
        code: 'NOT_FOUND',
        message: 'A rota solicitada não foi encontrada.'
      }
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
    return {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocorreu um erro interno inesperado.'
    }
  })
  // Rotas públicas
  .use(artistController(createArtistUseCase, authenticateArtistUseCase))
  .use(musicRequestController(requestMusicUseCase, getShowRequestsUseCase, cancelMusicRequestUseCase, markSongAsPlayedUseCase))
  // Rotas protegidas
  .guard({
    detail: {
      security: [{ bearerAuth: [] }]
    }
  }, (app) =>
    app
      .use(showController(startShowUseCase, finishShowUseCase))
      .use(repertoireController(addSongUseCase, getRepertoireUseCase, toggleAvailabilityUseCase))
  )

// 4. Configurar App
const app = new Elysia()
  .use(swagger({
    path: '/docs',
    documentation: {
      info: {
        title: 'Toque Aquela API',
        description: 'Documentação da API para a plataforma Toque Aquela',
        version: '0.0.1'
      },
      tags: [
        { name: 'Artist', description: 'Gerenciamento de artistas' },
        { name: 'Show', description: 'Ciclo de vida de apresentações ao vivo' },
        { name: 'Repertoire', description: 'Gestão do repertório de músicas do artista' },
        { name: 'Music Request', description: 'Pedidos de músicas pelo público (Fricção Zero)' }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    }
  }))

  // Health Check
  .get('/', () => ({
    status: 'online',
    message: 'Toque Aquela API is running!',
    version: '0.0.1',
    docs: '/docs'
  }))

  .use(v1Router)

  .listen(process.env.PORT ?? 3000)

logger.info(`🚀 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)