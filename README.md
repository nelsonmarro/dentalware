# Dentalware

Gestión interna de un laboratorio dental: trabajos, producción por fases, entregas y cuentas por clínica. Una sola app web (PWA) para PC y móvil.

## Requisitos

- Node 24 (`nvm use`), pnpm 11 (`corepack enable`), Docker.

## Desarrollo

```bash
pnpm install
pnpm db:up                      # PostgreSQL local (dev + test)
cp apps/api/.env.example apps/api/.env
pnpm --filter @dentalware/api seed   # crea el admin inicial
pnpm dev                        # shared (watch) + api :3000 + web :5173
```

## Calidad

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm e2e
```

Spec: `docs/superpowers/specs/2026-09-01-dentalware-mvp-design.md`.

## Despliegue (VPS con Docker)

```bash
git clone <repo> /opt/dentalware && cd /opt/dentalware
cp infra/.env.example infra/.env   # editar dominio, claves y admin
docker compose -p dentalware -f infra/docker-compose.yml --env-file infra/.env up -d --build
docker compose -p dentalware -f infra/docker-compose.yml --env-file infra/.env run --rm api node apps/api/dist/scripts/seed.js
```

Caddy obtiene el certificado TLS automáticamente para `SITE_ADDRESS`. Backups: `infra/backup.sh` en cron diario.
Actualizar: `git pull && docker compose -p dentalware -f infra/docker-compose.yml --env-file infra/.env up -d --build`.
