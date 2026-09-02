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
