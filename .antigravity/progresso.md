# Progresso do Projeto - Toque Aquela

## Última Atualização: 2026-05-14
**Status Atual**: Camada HTTP completa. TypeScript em modo strict sem erros. Pronto para frontend.

---

### Concluído ✅

#### Core / Domain
- Entidades: `Artist`, `Show`, `Song`, `MusicRequest` — 100% testadas.
  - `MusicRequest`: campo `customerSessionId` adicionado (RN13 — identificação sem login).
  - `Song.styleId`: tipado como `string | undefined` para refletir schema real do banco.
- Value Objects: `Email`, `Money`, `ShowDuration` — 100% testados.
- Erros Customizados: `AppError`, `BusinessRuleError`, `NotFoundError`, `UnauthorizedError`.

#### Application (Use Cases)
14 Use Cases implementados com `ILogger` e Injeção de Dependência — 100% testados:
- `CreateArtistUseCase`, `AuthenticateArtistUseCase`
- `StartShowUseCase`, `FinishShowUseCase`
- `RequestMusicUseCase`, `CancelMusicRequestUseCase`
- `GetShowRequestsUseCase`, `GetArtistMetricsUseCase`, `GetAppMetricsUseCase`
- `AddSongUseCase`, `ToggleSongAvailabilityUseCase`, `GetRepertoireUseCase`
- `MarkSongAsPlayedUseCase`
- `CreateStyleUseCase`, `MergeStylesUseCase`
- `ValidateAdminWhitelistUseCase`

#### Infraestrutura
- Drizzle ORM com PostgreSQL (schema + migrations).
- Isolamento Dev/Test via `.env` / `.env.test`.
- Repositórios Drizzle: `Artist`, `Show`, `Song`, `Style`, `MusicRequest`.
- `PinoLogger` (logs estruturados), `BunPasswordHasher` (OWASP).
- `verbatimModuleSyntax`: todos os imports de tipo usam `import type`.

#### HTTP / API — COMPLETO
- Framework: ElysiaJS com Swagger em `/docs`.
- Global Error Handler (mapeamento `AppError` → HTTP status).
- **4 controllers montados em `index.ts`:**
  - `ArtistController`: `POST /artists` (cadastro), `POST /artists/login` (login JWT).
  - `ShowController`: `POST /shows/start`, `POST /shows/finish` (protegidos por JWT).
  - `RepertoireController`: `GET /songs`, `POST /songs`, `PATCH /songs/:id/availability` (protegidos).
  - `MusicRequestController`:
    - `POST /shows/:showId/requests` — **público, sem JWT** (RN13: fricção zero).
    - `GET /shows/:showId/requests`, `PATCH /shows/:showId/songs/:songId/play`, `PATCH /shows/:showId/requests/:requestId/cancel` — protegidos por JWT.
- `authMiddleware` com `.derive({ as: 'global' }, ...)` — tipos propagam corretamente via `.use()`.
- `bun tsc --noEmit` → **0 erros** (TypeScript strict mode).

#### Testes e Qualidade
- **44 testes passando, 0 falhas** (16 arquivos).
- Cobertura de linhas: **99.71% geral** / **100% em Core e Application**.
- Bugs corrigidos na suite:
  - `auth.test.ts`: `MockArtistRepo` sem `passwordHash` causava falha silenciosa.
  - `create-artist.use-case.test.ts`: argumentos do construtor trocados (`logger` era `undefined`).
  - 6 testes com `expect().rejects.toThrow()` sem `await` (passavam vacuamente).
  - `request-music.use-case.ts`: `new Error()` genérico substituído por `BusinessRuleError`.
- Testes de integração: `findByEmail`, `delete` (Artist), `findActiveByArtistId`, `findAll` (Show).

---

### Em Aberto / Próximos Passos 🚀

1. **Frontend (prioritário)**
   - Página pública via QR Code: repertório do artista + formulário de pedido (RN13, fricção zero).
   - Painel do artista: lista de pedidos em tempo real, ordenada por gorjeta + chegada (RN02).
   - Tela de gerenciamento de repertório (adicionar músicas, alternar disponibilidade).
   - Stack: Vite + React (conforme `contexto_do_projeto.md`).

2. **Pagamentos**
   - Integração com gateway (Stripe ou Pagar.me) para gorjetas com cartão.
   - Lógica de estorno automático quando música é cancelada (RN05).
   - Divisão 85%/15% (RN07).

3. **Funcionalidades Admin**
   - Endpoints de métricas (`GetAppMetricsUseCase` já existe — expor via rota admin).
   - Curadoria de estilos via API (`CreateStyleUseCase`, `MergeStylesUseCase` — já existem).
   - Autenticação Admin via OAuth Google + Whitelist (RN12).

4. **Extras de Produção**
   - Rate limiting nos endpoints públicos (RN13 — controle de pedidos gratuitos por sessão).
   - Filtro de palavras ofensivas nas mensagens (RN08).
   - Deploy no Render.com via Docker.

---

### Regras de Ouro Mantidas 🏆
- Arquitetura Hexagonal rigorosa: Core/Application nunca dependem de ElysiaJS ou Drizzle.
- Nenhum `new Error()` genérico no domínio — apenas subclasses de `AppError`.
- `await` obrigatório em todas as asserções de rejeição nos testes.
- 100% de cobertura de linhas em Core e Application.
- `import type` para todos os imports de tipo (`verbatimModuleSyntax`).
- `.derive({ as: 'global' })` no ElysiaJS para propagação de tipos entre plugins.
