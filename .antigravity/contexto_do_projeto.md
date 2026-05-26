# Contexto do Projeto: Toque Aquela

Este arquivo contém a visão geral, objetivos e especificações do projeto.

## Visão Geral
O **Toque Aquela** é uma plataforma que moderniza a interação entre o público e os artistas em apresentações ao vivo (bares, boates, eventos). Substitui o antigo método de "bilhetes de papel" por uma interface digital fluida.

- **Nicho:** Entretenimento, Música ao Vivo, Pagamentos Digitais.
- **Tecnologia Principal:** Bun (JavaScript/TypeScript).

## Objetivos Principais
1. **Digitalização de Pedidos:** Permitir que o público peça músicas diretamente do repertório cadastrado pelo artista.
2. **Dedicatórias:** Facilitar o envio de mensagens e dedicatórias junto aos pedidos.
3. **Monetização (Tips):** Integrar um gateway de pagamento para contribuições financeiras voluntárias.
4. **Gestão de Receita:** Automatizar a divisão de valores entre a plataforma e o artista.

## Requisitos por Perfil

### 1. Artista
- **Repertório:** Cadastro de músicas (Nome, Artista Original, Estilo).
- **Gestão de Shows:**
    - Criar show com duração limitada (Duração inteira em horas; mín 1h, default 4h, máx 24h).
    - Regra: Apenas um show ativo por vez. Criar novo show encerra o anterior automaticamente.
    - **Ao criar show**, o artista é convidado (não obrigado) a conectar uma conta de pagamento para habilitar gorjetas (RN15).
- **Painel de Pedidos:**
    - Visualização ordenada por: **Maior Valor Doado** + **Ordem de Chegada**.
    - Agrupamento automático de pedidos para a mesma música.
    - Ação: Marcar música como "tocada" (remove da lista).
- **Financeiro:**
    - Cadastro gratuito com comissão sobre gorjetas.
    - **Conta de pagamento opcional** (Mercado Pago no MVP, arquitetura pronta para Stripe/Pagar.me). Sem conexão, o show funciona apenas com pedidos gratuitos (RN15/RN16).
    - Sem armazenamento de CPF, conta bancária ou chave PIX — KYC delegado integralmente ao gateway (RN17).
    - Futuro: Planos de assinatura para reduzir/zerar comissão.
- **Perfil:** Cadastro de redes sociais.

### 2. Administrador
- **Curadoria de Estilos:** Cadastro e gestão de estilos musicais (MPB, Rock, etc.) para evitar duplicidade e manter consistência.
- **Monitoramento:** Visualizar todos os shows ativos e encerrados.
- **Métricas e Dashboards:**
    - Músicas mais pedidas.
    - Valores arrecadados (Total, por Artista, do App).
    - Filtros por período (mês, ano).
- **Configurações Globais:** Definir percentual de comissão e valores de assinaturas.

### 3. Público
- **Acesso:** Via QR Code gerado pelo artista.
- **Interação:**
    - Visualizar repertório e redes sociais do artista.
    - Realizar pedidos (com ou sem mensagem/dedicatória).
    - Realizar contribuições financeiras (tips) via gateway integrado.
- **Futuro:** Perfil básico para interações e notificações push de artistas seguidos.

## Regras de Negócio Detalhadas

### Gestão de Shows
- **RN01 (Expiração):** Shows expiram automaticamente após a duração definida. Não são aceitos novos pedidos em shows expirados ou encerrados.
- **RN02 (Métricas):** 
    - **Artista:** Visualiza total doado, sua parte líquida e a comissão do App.
    - **App (Admin):** Músicas mais pedidas, músicas com maior arrecadação, artistas com mais pedidos, artistas com maior faturamento e faturamento total do App.

### Pedidos e Repertório
- **RN03 (Conclusão em Massa):** Marcar uma música como "Tocada" encerra todos os pedidos pendentes para aquela música no show atual.
- **RN04 (Valor Mínimo):** Cada artista define o valor mínimo de gorjeta para aceitar um pedido.
- **RN05 (Disponibilidade e Estorno):** Se uma música for desativada ou não tocada, o sistema deve prever a possibilidade de estorno do valor recebido.
- **RN09 (Pedidos Gratuitos):** Cada membro do público tem direito a apenas **1 pedido gratuito por show**. Pedidos subsequentes exigem gorjeta mínima.

### Financeiro e Segurança
- **RN06 (Termos de Uso):** As gorjetas são tratadas como **liberalidade do fã ao artista**; a plataforma apenas facilita o repasse via gateway com split nativo. O dinheiro nunca passa pela conta da plataforma — apenas a comissão (15%) é direcionada a ela na própria transação. Esse enquadramento jurídico/tributário é o que sustenta o tratamento de "gorjeta" e evita inflação artificial de faturamento.
- **RN07 (Taxas):** As taxas do gateway de pagamento são descontadas do valor bruto antes da divisão entre Artista e App.
- **RN08 (Moderação):** Filtro automático de palavras ofensivas nas dedicatórias/mensagens.
- **RN10 (Integridade de Estilos):** A alteração de um estilo pelo Admin reflete automaticamente em todas as músicas associadas.
- **RN11 (Autenticação Artista):** Suporte a E-mail/Senha e OAuth (Google/Apple), garantindo compatibilidade com iOS e Android (PWA).
- **RN12 (Segurança Admin):** Acesso restrito via whitelist de e-mails em env (`ADMIN_WHITELIST`) + Login JWT email/senha com `minLength ≥ 12` + Rate limit dedicado em `/artists/login` (5 tentativas / 15 min por IP) + log estruturado (`event: 'admin.access.*'`) de toda tentativa de acesso ao painel. **OAuth Google adiada deliberadamente** (decisão 2026-05-26): com ≤3 admins e blast radius limitado do painel (sem acesso a fluxo de dinheiro nem a tokens OAuth de artistas), o ganho do OAuth sobre senha forte + whitelist é marginal. Reabrir o tema apenas se: time admin crescer (>10), houver incidente de phishing, ou requisito externo de compliance.
- **RN13 (Acesso Público):** Modelo "Fricção Zero". Sem necessidade de login; identificação via sessão para controle de pedidos gratuitos e interação no show.

### Pagamentos (Multi-gateway, opt-in)
- **RN14 (Multi-gateway):** A plataforma suporta múltiplos gateways de pagamento via um Port único (`IPaymentGateway`). O MVP entrega **Mercado Pago** (já há familiaridade do operador, PIX nativo, OAuth simples para o artista). Stripe Connect e Pagar.me podem ser adicionados sem mudança no domínio/aplicação — apenas novos adapters.
- **RN15 (Cadastro Opt-in):** A conexão de conta de pagamento é **opcional** no cadastro do artista. Sem conta conectada, o artista pode usar todo o app (repertório, show, pedidos gratuitos). Apenas gorjetas exigem a conexão prévia. O CTA principal de conexão aparece **ao criar o primeiro show**, mas também é acessível no perfil.
- **RN16 (Split Nativo Obrigatório):** Toda transação de gorjeta é dividida **na própria transação pelo gateway** (85% artista / 15% plataforma). A plataforma **nunca custodia valores de terceiros** — isso evita enquadramento como Instituição de Pagamento (Lei 12.865/2013), retenção na fonte sobre repasses, e inflação tributária sobre o bruto.
- **RN17 (Mínimo de Dados Sensíveis):** A plataforma **não armazena CPF, conta bancária ou chave PIX** do artista. O gateway é o único responsável pela identidade financeira e KYC. A plataforma guarda apenas os tokens OAuth (criptografados em repouso) e o `accountId` externo necessários para roteamento do split.
- **RN18 (Estorno via Gateway):** Em caso de música não tocada ou desativada (RN05), o estorno é executado via API do gateway, revertendo automaticamente o split. O status do pedido transita para `refunded`.

## Arquitetura (Implementada & Validada)
- **Runtime:** Bun.
- **Linguagem:** TypeScript (Strict Mode, `verbatimModuleSyntax`, 0 erros em `bun tsc --noEmit`).
- **Estilo:** Limpa/Hexagonal, CQRS, OWASP.
- **Framework:** ElysiaJS 1.4 (Backend) + Vite/React (Frontend — pendente).
- **Banco de Dados:** PostgreSQL (Neon) + Drizzle ORM (schema + migrations). Driver dual-mode: `@neondatabase/serverless` HTTP em produção (sem pool stale), `postgres-js` em dev/testes.
- **Autenticação:** JWT Bearer (`@elysiajs/jwt`) com `expiresIn` configurável + bootstrap-check de secret. Admin: JWT + whitelist de e-mails (`ADMIN_WHITELIST` via env; tabela Postgres planejada para RN12 final).
- **Pagamentos:** Port `IPaymentGateway` (agnóstico) + `IPaymentGatewayRegistry` para resolução por nome. Adapter `MercadoPagoGateway` **100% implementado**: OAuth Connect (authorize + exchange PKCE/RFC 7636 + refresh), `createTipPayment` (PIX inline com `marketplace_fee` nativo 85/15, idempotente via `X-Idempotency-Key`), `refundTipPayment` (estorno via API), `fetchPaymentStatus` (para webhooks). Tokens OAuth criptografados em repouso via AES-256-GCM (`AesGcmTokenCipher`, chave de 32 bytes em `PAYMENT_TOKEN_KEY`). Identidade OAuth protegida por `state` one-shot (`InMemoryOAuthStateStore` TTL 10 min). Domínio expõe `Artist.paymentAccount?` e `MusicRequest.payment` (paymentId, gateway, status). Webhook `POST /v1/webhooks/mercado-pago` com validação HMAC-SHA256 e idempotência por status.
- **Identidade pública:** cookie HttpOnly assinado `customer_sid` para impedir bypass do RN09.
- **Endurecimento:** CORS, Security Headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS em prod), Rate Limit in-memory por IP, Profanity Filter PT-BR (RN08).
- **Documentação:** Swagger/OpenAPI ativa em `/docs`.
- **Testes:** Bun Test — **114 testes, 26 arquivos, 0 falhas**. Unit (use cases, entities, VOs, security, gateway) + integration (`*.integration.test.ts`).
- **Deploy:** Render.com via Docker (`render.yaml` configurado). UptimeRobot ativo para evitar cold starts. GitHub Actions CI/CD: pendente.

## Financeiro
- **Comissão Padrão:** 15% sobre o valor bruto das gorjetas.
- **Divisão:** Artista (85%) / Plataforma (15%) — aplicada via **split nativo** do gateway na própria transação (RN16).
- **Taxas:** Descontadas do valor bruto antes da divisão (RN07).
- **Custódia:** A plataforma **não custodia valores de terceiros** — apenas a comissão (15%) é direcionada à sua conta na transação. Isso preserva o enquadramento jurídico de "gorjeta/liberalidade" (RN06) e evita inflação tributária.
