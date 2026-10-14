#!/usr/bin/env bash
# Corre el proyecto `iphone` (WebKit) de los E2E en la imagen oficial de Playwright, con la
# misma versión que fija el catalog (#133). WebKit pide las librerías de Ubuntu que un Arch u
# otra distro no trae. Los servidores se reutilizan del host (`reuseExistingServer`): arranca
# antes la API en modo test y la web (`NODE_ENV=test pnpm --filter @dentalware/api dev` y
# `pnpm --filter @dentalware/web dev`), con la BD de test sembrada. Los argumentos extra van a
# `playwright test` (por ejemplo, un spec o `--grep "@esencial"`).
set -euo pipefail
cd "$(dirname "$0")/.."
version="$(node -p "require('@playwright/test/package.json').version")"
repo="$(cd ../.. && pwd)"
exec docker run --rm --network host -u "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$repo:/work" -w /work/apps/web "mcr.microsoft.com/playwright:v${version}-noble" \
  ./node_modules/.bin/playwright test --project=iphone "$@"
