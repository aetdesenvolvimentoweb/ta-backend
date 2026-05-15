# Progresso do Projeto - Toque Aquela

## Última Atualização: 2026-05-15
**Status Atual**: Backend funcionalmente completo (HTTP + Admin + Métricas) e endurecido (OWASP). Pronto para frontend e integração de pagamentos.

---

### Concluído ✅

#### Core / Domain
- Entidades: `Artist`, `Show`, `Song`, `MusicRequest` — 100% testadas.
- Value Objects: `Email`, `Money`, `ShowDuration` (range 1–24h inteiras) — 100% testados.
- Erros Customizados: `AppError`, `BusinessRuleError`, `NotFoundError`, `UnauthorizedError`.

#### Application (Use Cases)
17 Use Cases com `ILogger` + injeção de dependência. **Autorização (ownership) embutida** nos use cases que tocam recursos por ID:
- `CreateArtistUseCase`, `AuthenticateArtistUseCase`
- `StartShowUseCase`, `FinishShowUseCase` (valida `show.artistId === input.artistId`)
- `RequestMusicUseCase` (RN09 + RN08: mensagens sanitizadas via `IProfanityFilter`; valida `song.artistId === show.artistId`)
- `CancelMusicRequestUseCase`, `MarkSongAsPlayedUseCase`, `GetShowRequestsUseCase` (todos validam ownership via `show.artistId`)
- `AddSongUseCase`, `ToggleSongAvailabilityUseCase` (valida `song.artistId`), `GetRepertoireUseCase`
- `CreateStyleUseCase`, `MergeStylesUseCase`
- `ValidateAdminWhitelistUseCase`
- `GetArtistMetricsUseCase`, `GetAppMetricsUseCase` — agregação real via SQL (não mais stubs).

#### Infraestrutura
- Drizzle ORM com PostgreSQL (schema + migrations).
- Repositórios Drizzle: `Artist`, `Show`, `Song`, `Style`, `MusicRequest`, `AdminWhitelist` (env-backed, contrato preservado).
- `PinoLogger`, `BunPasswordHasher`.
- **`infra/config/env.ts`**: fail-fast bootstrap — exige `DATABASE_URL`, `JWT_SECRET` (≥32c), `COOKIE_SECRET` (≥32c).
- **`BasicProfanityFilter`** (PT-BR, stems + normalização sem acentos) — testado.

#### HTTP / API — COMPLETO E ENDURECIDO
- ElysiaJS 1.4 + Swagger em `/docs`.
- **Global Error Handler** (mapeamento `AppError` → HTTP).
- **CORS** (`@elysiajs/cors`) com origin configurável via env.
- **Security headers** (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS em prod).
- **Rate limiting** in-memory (token bucket por IP, janela e limite via env). Para multi-instância → Redis.
- **JWT** com `expiresIn` configurável (default 7d) + bootstrap-check do secret.
- **Cookie HttpOnly assinado** `customer_sid` para identificar sessão pública (RN09), impedindo bypass via body.

##### Rotas (todas sob `/v1`)
- `POST /v1/artists`, `POST /v1/artists/login`
- `POST /v1/shows`, `POST /v1/shows/:id/finish` *(JWT + ownership)*
- `GET/POST /v1/songs`, `PATCH /v1/songs/:id/availability` *(JWT + ownership)*
- `POST /v1/shows/:showId/requests` *(público, cookie de sessão)*
- `GET /v1/shows/:showId/requests`, `PATCH /v1/shows/:showId/songs/:songId/play`, `PATCH /v1/shows/:showId/requests/:requestId/cancel` *(JWT + ownership)*
- `GET /v1/metrics/me` *(JWT — métricas do artista)*
- `GET /v1/admin/metrics`, `POST /v1/admin/styles`, `POST /v1/admin/styles/merge` *(JWT + whitelist)*

#### Testes e Qualidade
- **58 testes passando, 0 falhas** (18 arquivos) — unit + VO + filtro.
- `bun tsc --noEmit` → **0 erros** (TypeScript strict + `verbatimModuleSyntax`).

---

### Em Aberto / Próximos Passos 🚀

1. **Frontend (Vite + React)**
   - Página pública (QR Code) — repertório + pedido (cookie de sessão).
   - Painel do artista (login, lista de pedidos em tempo real, mark-as-played).
   - Gerenciamento de repertório.
   - Painel admin (whitelist + métricas globais).

2. **Pagamentos**
   - Decisão: Stripe Connect vs Pagar.me Split (PIX, BR).
   - Integração de tip com cartão/PIX, webhook, estorno (RN05).

3. **Autenticação Admin Completa (RN12)**
   - OAuth Google + tabela `admin_whitelist` em Postgres (substituir o repo env-backed sem tocar o use case).

4. **Deploy**
   - Render.com via Docker + GitHub Actions (test → build → deploy).
   - Migração do rate limit in-memory para Redis quando houver >1 instância.

5. **Observabilidade**
   - Health check expandido (`/health` com checagem de DB).
   - Métricas (RED) + tracing.

---

### Regras de Ouro Mantidas 🏆
- Arquitetura Hexagonal rigorosa: Core/Application nunca dependem de ElysiaJS ou Drizzle.
- Nenhum `new Error()` genérico no domínio — apenas subclasses de `AppError`.
- `await` obrigatório em todas as asserções de rejeição nos testes.
- 100% de cobertura de linhas em Core e Application.
- `import type` para todos os imports de tipo.
- **Ownership como regra de domínio**: use cases que tocam recurso por ID exigem `artistId` no input e validam contra o agregado.
- **Identidade pública via servidor**: nunca aceitar `sessionId` do cliente; sempre emitir cookie HttpOnly assinado.
