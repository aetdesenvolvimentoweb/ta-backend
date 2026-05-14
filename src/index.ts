import { swagger } from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import { AppError } from './core/errors/app-error'
import { PinoLogger } from './infra/logger/pino-logger'
import { DrizzleArtistRepository } from './infra/db/repositories/drizzle-artist.repository'
import { DrizzleShowRepository } from './infra/db/repositories/drizzle-show.repository'
import { DrizzleMusicRequestRepository } from './infra/db/repositories/drizzle-music-request.repository'
import { BunPasswordHasher } from './infra/security/bun-password-hasher'

// Use Cases
import { CreateArtistUseCase } from './application/use-cases/create-artist.use-case'
import { AuthenticateArtistUseCase } from './application/use-cases/authenticate-artist.use-case'
import { StartShowUseCase } from './application/use-cases/start-show.use-case'
import { FinishShowUseCase } from './application/use-cases/finish-show.use-case'

// Controllers
import { artistController } from './infra/http/controllers/artist.controller'
import { showController } from './infra/http/controllers/show.controller'


// 1. Instanciar Infra
const logger = new PinoLogger()
const passwordHasher = new BunPasswordHasher()
const artistRepository = new DrizzleArtistRepository()
const showRepository = new DrizzleShowRepository()
const requestRepository = new DrizzleMusicRequestRepository()

// 2. Instanciar Use Cases
const createArtistUseCase = new CreateArtistUseCase(artistRepository, passwordHasher, logger)
const authenticateArtistUseCase = new AuthenticateArtistUseCase(artistRepository, passwordHasher, logger)
const startShowUseCase = new StartShowUseCase(showRepository, artistRepository, logger)
const finishShowUseCase = new FinishShowUseCase(showRepository, requestRepository, logger)

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
  .use(artistController(createArtistUseCase, authenticateArtistUseCase))
  // Rotas protegidas
  .guard({
    detail: {
      security: [{ bearerAuth: [] }]
    }
  }, (app) =>
    app.use(showController(startShowUseCase, finishShowUseCase))
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
        { name: 'Show', description: 'Ciclo de vida de apresentações ao vivo' }
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