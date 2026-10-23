# syntax=docker/dockerfile:1
# Manual de usuario (Iteración 8): construye el sitio de Docusaurus y lo sirve Caddy.
FROM node:24-alpine AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true HUSKY=0
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/docs/package.json apps/docs/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @dentalware/docs...
COPY packages/shared packages/shared
COPY apps/docs apps/docs
RUN pnpm --filter @dentalware/shared build && pnpm --filter @dentalware/docs build

FROM caddy:2-alpine
COPY infra/Caddyfile.docs /etc/caddy/Caddyfile
COPY --from=build /app/apps/docs/build /srv
