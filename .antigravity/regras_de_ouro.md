# Regras de Ouro - Toque Aquela

## Arquitetura e Código
1. **Independência de Framework**: a lógica de negócio (core/application) nunca depende do ElysiaJS ou do Drizzle. Use Ports (Interfaces).
2. **Value Objects**: sempre use VOs para validação de dados complexos (Email, Money, ShowDuration etc.). Se a invariante for violada, o erro é lançado no construtor.
3. **Tratamento de Erros**: nunca lançar `Error` genérico. Use as subclasses de `AppError` (`BusinessRuleError`, `NotFoundError`, `UnauthorizedError`).
4. **Logging**: todo Use Case injeta `ILogger` e registra eventos críticos (sucessos e falhas de regra/segurança).
5. **Ownership é regra de domínio**: qualquer Use Case que opere sobre um recurso por ID recebe `artistId` no input e valida contra o agregado raiz (ex.: `show.artistId === input.artistId`). Autorização **não fica no controller**.

## Segurança (OWASP)
6. **Identidade pública via servidor**: nunca confiar em `sessionId`/`customerId` vindos do body. Emitir cookie HttpOnly assinado (`customer_sid`).
7. **Segredos via env validados no boot**: `JWT_SECRET` e `COOKIE_SECRET` com mínimo de 32 caracteres. Fail-fast em `infra/config/env.ts` antes do Elysia subir.
8. **JWT com expiração obrigatória** (`exp`). Default 7d, configurável por env.
9. **Validação de schema em todas as rotas**: `body`, `params`, `cookie` tipados via `t.*`. Limites de tamanho explícitos em strings públicas (`maxLength`).
10. **Moderação automática**: mensagens públicas passam por `IProfanityFilter` antes da persistência (RN08).
11. **Rate limit + CORS + Security headers** ativos no entry point; em produção, HSTS obrigatório.

## Testes
12. **Co-localização**: testes unitários ficam junto ao código (`.test.ts`).
13. **Integração**: testes que tocam o banco real usam o sufixo `.integration.test.ts` e o banco `ta_test`, com `TRUNCATE` entre testes.
14. **`await` em rejeições**: todo `expect(...).rejects.toThrow(...)` precisa de `await` — sem isso o teste passa vacuamente.
15. **Cobertura**: manter 100% de cobertura de linhas nas camadas de Core e Application.

## Infraestrutura
16. **Drizzle**: o schema do banco reflete fielmente as entidades de domínio.
17. **Ambientes isolados**: nunca usar credenciais de produção em desenvolvimento. `.env`, `.env.test`, `.env.example`.
18. **Imports**: `import type` para todos os imports de tipo (`verbatimModuleSyntax`).
