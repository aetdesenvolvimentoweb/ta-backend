# Progresso do Projeto - Toque Aquela

## Última Atualização: 2026-05-17
**Status Atual**: Backend **100% completo** — arquitetura hexagonal, 23 use cases, 18 rotas, segurança OWASP, **Entrega B de Pagamentos concluída** (cobrança PIX com split nativo 85/15, estorno automático, webhook com validação HMAC). Infra de produção estabilizada (Neon HTTP driver + UptimeRobot). Próximo milestone: `/admin` (último stub do frontend).

---

### Concluído ✅

#### Core / Domain
- Entidades: `Artist` (com `paymentAccount?` opt-in), `Show`, `Song`, `MusicRequest` (com bloco `payment?` para gateway/paymentId/status) — 100% testadas.
- Value Objects: `Email`, `Money`, `ShowDuration` (range 1–24h inteiras), `PaymentAccount` (gateway + externalAccountId + connectedAt) — 100% testados.
- Erros Customizados: `AppError`, `BusinessRuleError`, `NotFoundError`, `UnauthorizedError`.
- Ports de pagamento: `IPaymentGateway` (agnóstico, contratos para OAuth + criação/estorno de tip).

#### Application (Use Cases)
20 Use Cases com `ILogger` + injeção de dependência. **Autorização (ownership) embutida** nos use cases que tocam recursos por ID:
- `CreateArtistUseCase`, `AuthenticateArtistUseCase`
- `StartShowUseCase`, `FinishShowUseCase` (valida `show.artistId === input.artistId`)
- `RequestMusicUseCase` (RN09 + RN08 + RN15: mensagens sanitizadas via `IProfanityFilter`; valida `song.artistId === show.artistId`; bloqueia tip > 0 quando `artist.canReceiveTips()` é false)
- `CancelMusicRequestUseCase`, `MarkSongAsPlayedUseCase`, `GetShowRequestsUseCase` (todos validam ownership via `show.artistId`)
- `AddSongUseCase`, `ToggleSongAvailabilityUseCase` (valida `song.artistId`), `GetRepertoireUseCase`
- `CreateStyleUseCase`, `MergeStylesUseCase`
- `ValidateAdminWhitelistUseCase`
- `GetArtistMetricsUseCase`, `GetAppMetricsUseCase` — agregação real via SQL (não mais stubs).
- **Pagamentos (Entrega A)**: `StartPaymentConnectionUseCase`, `CompletePaymentConnectionUseCase`, `DisconnectPaymentAccountUseCase` — fluxo OAuth Connect agnóstico de gateway via `IPaymentGatewayRegistry`.
- **Pagamentos (Entrega B)**: `CreateTipPaymentUseCase` (cria PIX com split nativo, idempotente), `RefundTipPaymentUseCase` (estorna pagamento aprovado ou cancela diretamente), `ProcessPaymentNotificationUseCase` (webhook — busca status real no gateway, atualiza `MusicRequest`, idempotente).

#### Infraestrutura
- Drizzle ORM com PostgreSQL (schema + migrations).
- Repositórios Drizzle: `Artist` (com colunas de pagamento + tokens encriptados), `Show`, `Song`, `Style`, `MusicRequest` (com bloco payment), `AdminWhitelist` (env-backed), **`PaymentCredentials`** (port isolado, cifra/decifra tokens em trânsito).
- **Driver de banco dual-mode**: `@neondatabase/serverless` HTTP em produção (URL `.neon.tech`) — sem pool persistente, sem conexões obsoletas quando o Neon pausa. `postgres-js` em dev/testes (localhost).
- `PinoLogger`, `BunPasswordHasher`.
- **`infra/config/env.ts`**: fail-fast bootstrap — exige `DATABASE_URL`, `JWT_SECRET` (≥32c), `COOKIE_SECRET` (≥32c), **`PAYMENT_TOKEN_KEY`** (hex 64 chars).
- **`BasicProfanityFilter`** (PT-BR, stems + normalização sem acentos) — testado.
- **Pagamentos (Entrega A)**:
  - `AesGcmTokenCipher` — AES-256-GCM com IV aleatório de 12B; tokens em repouso autenticados (RN17/22).
  - `InMemoryOAuthStateStore` — TTL 10min + sweeper periódico para o `state` OAuth (one-shot, anti-CSRF/replay).
  - `pkce.ts` — `generateCodeVerifier`/`deriveCodeChallenge`/`generateOAuthState` (RFC 7636).
  - `PaymentGatewayRegistry` — resolve adapters por nome (`mercado_pago` registrado; Stripe/Pagar.me prontos para entrar).
  - `MercadoPagoGateway` — implementa `IPaymentGateway` completo: OAuth (authorize, exchange com PKCE, refresh) + **`createTipPayment`** (PIX inline com `marketplace_fee` nativo 85/15) + **`refundTipPayment`** (estorno via API) + **`fetchPaymentStatus`** (busca status atual para webhooks).
  - `IMusicRequestRepository`: adicionado `findByPaymentId` para lookup via webhook.
  - `CancelMusicRequestUseCase` e `FinishShowUseCase`: injetam `RefundTipPaymentUseCase` para estorno automático (RN05/RN18).

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
- `POST /v1/shows`, `POST /v1/shows/:showId/finish` *(JWT + ownership)*
- `GET/POST /v1/songs`, `PATCH /v1/songs/:id/availability` *(JWT + ownership)*
- `POST /v1/shows/:showId/requests` *(público, cookie de sessão — retorna `payment.checkoutUrl` quando tip > 0)*
- `GET /v1/shows/:showId/requests`, `PATCH /v1/shows/:showId/songs/:songId/play`, `PATCH /v1/shows/:showId/requests/:requestId/cancel` *(JWT + ownership)*
- `GET /v1/metrics/me` *(JWT — métricas do artista)*
- `POST /v1/payment-accounts/:gateway/connect` *(JWT — inicia OAuth Connect, devolve authorizeUrl + state)*
- `GET /v1/payment-accounts/callback` *(público — identidade provada pelo state)*
- `DELETE /v1/payment-accounts/:gateway` *(JWT — desconecta a conta)*
- **`POST /v1/webhooks/mercado-pago`** *(público — autenticado via HMAC-SHA256; fonte autoritativa de status de pagamento)*
- `GET /v1/admin/metrics`, `POST /v1/admin/styles`, `POST /v1/admin/styles/merge` *(JWT + whitelist)*

#### Testes e Qualidade
- **114 testes passando, 0 falhas** (26 arquivos) — unit + VO + filtro + cipher + PKCE + state store + adapter MP (OAuth + PIX + estorno + fetchStatus) + use cases de conexão e pagamento + integração.
- `bun tsc --noEmit` → **0 erros** (TypeScript strict + `verbatimModuleSyntax`). `MockStyleRepo` corrigido (`findByIds` adicionado).
- DB sincronizado (`bun db:push` e `bun db:push:test`) com as novas colunas de pagamento.

---

### Em Aberto / Próximos Passos 🚀

1. **Validação ponta a ponta (manual)**
   - Subir o server com credenciais Mercado Pago de teste (`TESTUSER`).
   - Fluxo: artista autenticar → OAuth Connect → cliente pedir música com gorjeta → escanear PIX QR → webhook MP atualizar status → artista cancelar → verificar estorno automático.
   - Configurar `MP_WEBHOOK_SECRET` no painel do Mercado Pago (Configurações → Webhooks).

2. **Frontend (Vite + React)**
   - Página pública (QR Code) — repertório + pedido (cookie de sessão).
   - Painel do artista (login, lista de pedidos em tempo real, mark-as-played).
   - **Onboarding de pagamento** ao criar primeiro show (CTA "Conectar Mercado Pago" — RN15).
   - Gerenciamento de repertório.
   - Painel admin (whitelist + métricas globais).

3. **Autenticação Admin Completa (RN12)**
   - OAuth Google + tabela `admin_whitelist` em Postgres (substituir o repo env-backed sem tocar o use case).

4. **Deploy** ✅ (parcial)
   - Render.com via Docker configurado (`render.yaml`). **UptimeRobot ativo** (ping a cada 5 min — elimina cold starts no free tier).
   - GitHub Actions (test → build → deploy): pendente.
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
