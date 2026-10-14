# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true HUSKY=0
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @dentalware/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @dentalware/api... build
# Solo lo que corre: dist/, drizzle/ y las dependencias de producción (con shared ya compilado).
# `deploy` exige `inject-workspace-packages` (solo en este build: en desarrollo cambiaría el `pnpm install`).
RUN pnpm_config_inject_workspace_packages=true pnpm --filter @dentalware/api deploy --prod /prod/api
# better-auth declara drizzle-kit y vitest como peers opcionales y pnpm los enlaza porque la
# API los usa en desarrollo: en producción son ~90 MB que nadie carga. Fuera ellos y sus enlaces.
RUN cd /prod/api/node_modules/.pnpm \
    && rm -f better-auth@*/node_modules/drizzle-kit better-auth@*/node_modules/vitest \
    && rm -rf drizzle-kit@* vitest@*

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /prod/api /app
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "dist/main.js"]
