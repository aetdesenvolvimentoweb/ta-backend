import { Elysia } from 'elysia'

const app = new Elysia()
  .get('/', () => ({ 
    status: 'online', 
    message: 'Toque Aquela API is running!',
    version: '0.0.1'
  }))
  .listen(process.env.PORT ?? 3000)

console.log(
  `?? Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)