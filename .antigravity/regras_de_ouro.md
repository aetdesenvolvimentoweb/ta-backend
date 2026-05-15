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

## Pagamentos
19. **Multi-gateway por design (RN14)**: toda lógica de pagamento depende **apenas do Port `IPaymentGateway`**. Nenhum use case importa SDKs de gateway, IDs proprietários ou enums específicos (`mercadopago`, `stripe`...). Adicionar um novo gateway = novo adapter + entrada no registry, zero mudança em `core/application`.
20. **Split nativo obrigatório (RN16)**: a plataforma **nunca custodia valor de terceiros**. Toda transação de gorjeta sai do gateway já dividida (85/15). Modelos "conta-única com repasse manual" estão proibidos — comprometem o enquadramento jurídico de gorjeta/liberalidade (RN06) e disparam riscos tributários e regulatórios (BACEN/COAF).
21. **Mínimo de dados financeiros (RN17)**: NÃO persistir CPF, conta bancária, chave PIX ou qualquer dado fiscal do artista. O gateway é o source-of-truth de identidade financeira. A plataforma guarda **apenas** o `externalAccountId` e tokens OAuth (criptografados em repouso). Se um dia uma tela precisar do dado, busca no gateway via API — não duplica.
22. **Tokens OAuth criptografados em repouso**: `accessToken`/`refreshToken` de gateway nunca são gravados em plain text. Camada de criptografia simétrica (AES-GCM) com chave em env (`PAYMENT_TOKEN_KEY`). Adapter expõe métodos para encrypt/decrypt; repositório nunca vê plain text.
23. **Idempotência em webhooks de pagamento**: todo handler de webhook é idempotente (uso de `paymentId` + `eventId` para deduplicação). Webhooks são fonte autoritativa do `paymentStatus` — não confiar no callback síncrono do cliente.
24. **Habilitar tip exige conta conectada (RN15)**: `RequestMusicUseCase` recusa `tipAmountInCents > 0` quando `artist.canReceiveTips()` é false. Pedido gratuito (`tipAmountInCents === 0`) continua aceito mesmo sem conta — o app funciona sem pagamento.
