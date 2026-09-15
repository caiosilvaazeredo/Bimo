# Build de contexto na raiz do monorepo:
#   docker build -f apps/web/Dockerfile -t bimo-web \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.seu-dominio.com .

FROM node:20-slim AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace apps/web --include-workspace-root

COPY apps/web apps/web

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build --workspace apps/web

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# output:'standalone' já empacota um server.js mínimo com só o necessário.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

EXPOSE 3001
ENV PORT=3001
CMD ["node", "apps/web/server.js"]
