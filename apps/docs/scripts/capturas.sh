#!/usr/bin/env bash
# Capturas del manual (Iteración 8). Modo completo: contraseña nueva, reseed y API propia con el
# reloj fijo (la arranca Playwright). Modo rápido (CAPTURAS_RAPIDO=1): reutiliza la API que dejó
# `capturas:servidores`, la BD y las sesiones; solo vuelve a tomar lo que se pida.
# La contraseña de demostración vive en capturas/.auth/demo-password (local, ignorado por git).
set -euo pipefail
cd "$(dirname "$0")/.."
auth_dir="capturas/.auth"
password_file="$auth_dir/demo-password"
# PID de la API de demostración que dejó `capturas:servidores`.
pid_file="$auth_dir/api.pid"
port_in_use() { (echo >"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
demo_api_alive() { [ -s "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; }

if [ "${CAPTURAS_RAPIDO:-}" = "1" ]; then
  # No basta con que algo escuche en 3000: tiene que ser la API de `capturas:servidores` (la de
  # los E2E o la de desarrollo no tienen los datos de demostración ni el reloj fijo).
  if ! port_in_use 3000 || ! demo_api_alive || [ ! -s "$password_file" ]; then
    echo "Modo rápido: no está corriendo la API de demostración. Déjala lista con: pnpm --filter @dentalware/docs capturas:servidores" >&2
    exit 1
  fi
  DEMO_PASSWORD="$(cat "$password_file")"
else
  if port_in_use 3000; then
    echo "El puerto 3000 está ocupado: el modo completo arranca su propia API (con reloj fijo). Para la que corre o usa CAPTURAS_RAPIDO=1." >&2
    exit 1
  fi
  mkdir -p "$auth_dir" && chmod 700 "$auth_dir" # sesiones y contraseña: solo para ti
  DEMO_PASSWORD="$(node -e 'console.log("Aa1"+require("node:crypto").randomBytes(9).toString("base64url"))')"
  (umask 077 && printf '%s' "$DEMO_PASSWORD" >"$password_file")
fi
export DEMO_PASSWORD
# `pnpm capturas -- <spec> -g <patrón>` reenvía el `--`, y Playwright ignora lo que va detrás de él:
# sin quitarlo, corría todas las capturas.
if [ "${1:-}" = "--" ]; then shift; fi
./node_modules/.bin/playwright test --config capturas/playwright.config.ts --tsconfig capturas/tsconfig.playwright.json "$@"
echo "Capturas que cambiaron (git status):"
git -C ../.. status --short -- apps/docs/static/img/capturas | sed 's/^/  /'
