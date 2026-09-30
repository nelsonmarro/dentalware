# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true HUSKY=0
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @dentalware/web...
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
# URL pública con la que se imprime el QR de la orden de trabajo (`apps/web/src/lib/public-url.ts`).
# Vite la incrusta al compilar, así que tiene que llegar como argumento de build: la pasa
# docker-compose desde PUBLIC_URL. Sin ella, el QR usaría el origen desde el que se abrió la app
# (p. ej. la IP del VPS), y ese papel circula semanas por el laboratorio.
ARG VITE_PUBLIC_URL
ENV VITE_PUBLIC_URL=$VITE_PUBLIC_URL
RUN pnpm --filter @dentalware/web... build

FROM caddy:2-alpine
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
