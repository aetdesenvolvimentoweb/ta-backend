# Usando a imagem oficial do Bun
FROM oven/bun:latest as base
WORKDIR /usr/src/app

# Instalação das dependências
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Preparação do código
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# Imagem final de produção
FROM base AS release
COPY --from=install /temp/dev/node_modules node_modules
COPY --from=prerelease /usr/src/app/src src
COPY --from=prerelease /usr/src/app/package.json .

# Execução
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "src/index.ts" ]
