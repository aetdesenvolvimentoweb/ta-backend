import { swagger } from '@elysiajs/swagger'
import { Elysia } from 'elysia'

const app = new Elysia()
  .use(swagger({
    path: '/v1/swagger',
    documentation: {
      info: {
        title: 'Toque Aquela API',
        description: 'Documentação da API para a plataforma Toque Aquela',
        version: '0.0.1'
      }
    }
  }))
  .get('/', () => ({ 
    status: 'online', 
    message: 'Toque Aquela API is running!',
    version: '0.0.1',
    docs: '/v1/swagger'
  }))
  .listen(process.env.PORT ?? 3000)

console.log(
  `?? Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)