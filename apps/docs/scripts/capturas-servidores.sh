#!/usr/bin/env bash
# Deja la API de demostración lista para el modo rápido de las capturas: contraseña nueva,
# reset-test-db → seed → seed:demo, y la API en modo test con el reloj fijo, en primer plano
# (córrelo en segundo plano y anota el PID para pararla después). La web dev se arranca aparte
# (`pnpm --filter @dentalware/web dev`) o la arranca Playwright.
set -euo pipefail
cd "$(dirname "$0")/.."
root="$(cd ../.. && pwd)"
auth_dir="capturas/.auth"
mkdir -p "$auth_dir" && chmod 700 "$auth_dir" # sesiones y contraseña: solo para ti
if (echo >/dev/tcp/127.0.0.1/3000) 2>/dev/null; then
  echo "El puerto 3000 está ocupado: para esa API antes." >&2
  exit 1
fi
DEMO_PASSWORD="$(node -e 'console.log("Aa1"+require("node:crypto").randomBytes(9).toString("base64url"))')"
(umask 077 && printf '%s' "$DEMO_PASSWORD" >"$auth_dir/demo-password")
# El reseed invalida las sesiones guardadas: la primera corrida rápida vuelve a entrar.
rm -f "$auth_dir"/*.json
export DEMO_PASSWORD NODE_ENV=test CLOCK_FIXED_AT=2026-10-20T10:30:00-05:00
cd "$root"
pnpm --filter @dentalware/shared build
pnpm --filter @dentalware/api reset-test-db
pnpm --filter @dentalware/api seed
pnpm --filter @dentalware/api seed:demo
echo "API de demostración lista (reloj fijo en $CLOCK_FIXED_AT). Capturas: CAPTURAS_RAPIDO=1 pnpm capturas -- <spec> -g <patrón>"
exec pnpm --filter @dentalware/api dev
