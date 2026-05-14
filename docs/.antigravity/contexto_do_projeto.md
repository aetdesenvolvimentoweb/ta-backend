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
    - Criar show com duração limitada (Duração definida na criação: default 4h, máx 24h).
    - Regra: Apenas um show ativo por vez. Criar novo show encerra o anterior automaticamente.
- **Painel de Pedidos:**
    - Visualização ordenada por: **Maior Valor Doado** + **Ordem de Chegada**.
    - Agrupamento automático de pedidos para a mesma música.
    - Ação: Marcar música como "tocada" (remove da lista).
- **Financeiro:**
    - Cadastro gratuito com comissão sobre gorjetas.
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
- **RN06 (Termos de Uso):** As gorjetas são tratadas como apoio ao artista. Regras detalhadas serão elaboradas nos termos de uso.
- **RN07 (Taxas):** As taxas do gateway de pagamento são descontadas do valor bruto antes da divisão entre Artista e App.
- **RN08 (Moderação):** Filtro automático de palavras ofensivas nas dedicatórias/mensagens.
- **RN10 (Integridade de Estilos):** A alteração de um estilo pelo Admin reflete automaticamente em todas as músicas associadas.
- **RN11 (Autenticação Artista):** Suporte a E-mail/Senha e OAuth (Google/Apple), garantindo compatibilidade com iOS e Android (PWA).
- **RN12 (Segurança Admin):** Acesso restrito via Whitelist de e-mails + Login obrigatório via OAuth (Google) para máxima segurança.
- **RN13 (Acesso Público):** Modelo "Fricção Zero". Sem necessidade de login; identificação via sessão para controle de pedidos gratuitos e interação no show.

## Arquitetura (Implementada & Validada)
- **Runtime:** Bun
- **Linguagem:** TypeScript (Strict Mode)
- **Estilo:** Limpa/Hexagonal, CQRS, OWASP.
- **Framework:** ElysiaJS (Backend) + Vite/React (Frontend).
- **Banco de Dados:** PostgreSQL + Drizzle ORM (Pendente configuração).
- **Documentação:** Swagger/OpenAPI ativa em `/v1/swagger`.
- **Testes:** Bun Test (Unitários de Domínio e Application 100%).
- **Deploy:** Render.com via Docker.

## Financeiro
- **Comissão Padrão:** 15% sobre o valor bruto das gorjetas.
- **Divisão:** Artista (85%) / Plataforma (15%).
- **Taxas:** Descontadas do valor bruto antes da divisão (RN07).
