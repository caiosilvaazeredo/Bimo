# Build de contexto na raiz do monorepo (é um workspace npm):
#   docker build -f apps/api/Dockerfile -t bimo-api .
#
# node-oracledb roda em modo "Thin" por padrão (puro JS/TLS), sem precisar
# do Oracle Instant Client instalado na imagem — só a Wallet montada em
# runtime (ver docker-compose.yml na raiz).

FROM node:20-slim AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --workspace apps/api --include-workspace-root

COPY apps/api apps/api
RUN npm run build --workspace apps/api

FROM node:20-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --workspace apps/api --include-workspace-root --omit=dev

COPY --from=build /repo/apps/api/dist apps/api/dist

EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
