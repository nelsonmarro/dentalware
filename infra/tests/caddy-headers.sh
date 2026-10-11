#!/usr/bin/env bash
# Prueba de punta a punta del Caddy de producción (#19): construye la imagen web, levanta solo
# Caddy con SITE_ADDRESS=:80 (como detrás del nginx del VPS) en un puerto libre del host y
# comprueba las cabeceras de caché y de seguridad, y que el contenedor llega a «healthy».
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
project="dw-caddy-test"
port="${CADDY_TEST_PORT:-18080}"
base="http://127.0.0.1:${port}"
tmp="$(mktemp -d)"
failures=0

cleanup() {
  docker compose -p "$project" -f "$root/infra/docker-compose.yml" -f "$tmp/override.yml" \
    --env-file "$tmp/.env" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

# Entorno propio y desechable: ningún secreto real.
{
  echo "PUBLIC_URL=http://127.0.0.1:${port}"
  echo "SITE_ADDRESS=:80"
  echo "POSTGRES_USER=dw"
  echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
  echo "POSTGRES_DB=dw"
  echo "BETTER_AUTH_SECRET=$(openssl rand -hex 24)"
  echo "ADMIN_EMAIL=prueba@example.com"
  echo "ADMIN_PASSWORD=$(openssl rand -hex 24)"
  echo "ADMIN_NAME=Prueba"
} >"$tmp/.env"

cat >"$tmp/override.yml" <<YML
services:
  caddy:
    ports: !override
      - '127.0.0.1:${port}:80'
YML

compose() {
  docker compose -p "$project" -f "$root/infra/docker-compose.yml" -f "$tmp/override.yml" \
    --env-file "$tmp/.env" "$@"
}

fail() {
  echo "FALLA: $*" >&2
  failures=$((failures + 1))
}

# header_of <ruta> <cabecera>: valor de la cabecera de la respuesta (vacío si no está).
header_of() {
  curl -sI "${base}$1" | tr -d '\r' | awk -v h="$2" 'tolower($1) == tolower(h) ":" { sub(/^[^:]*: */, ""); print; exit }'
}

status_of() {
  curl -s -o /dev/null -w '%{http_code}' "${base}$1"
}

expect_header() {
  local path="$1" name="$2" expected="$3" actual
  actual="$(header_of "$path" "$name")"
  if [ "$actual" != "$expected" ]; then
    fail "${path}: ${name} esperado «${expected}», llegó «${actual}»"
  fi
}

expect_present() {
  local path="$1" name="$2"
  if [ -z "$(header_of "$path" "$name")" ]; then
    fail "${path}: falta la cabecera ${name}"
  fi
}

echo "Construyendo y levantando Caddy (puede tardar unos minutos)..."
compose up -d --build --no-deps caddy

for _ in $(seq 1 60); do
  [ "$(status_of /)" = "200" ] && break
  sleep 1
done

# El shell, el service worker y el manifiesto nunca se cachean.
for path in / /login /trabajos/x /sw.js /manifest.webmanifest; do
  [ "$(status_of "$path")" = "200" ] || fail "${path}: no responde 200"
  expect_header "$path" Cache-Control "no-cache"
done

# Un archivo real de /assets/ (el primero que enlaza index.html) es inmutable.
asset="$(curl -s "${base}/" | grep -oE '/assets/[^"]+' | head -n 1 || true)"
if [ -z "$asset" ]; then
  fail "index.html no enlaza ningún archivo de /assets/"
else
  [ "$(status_of "$asset")" = "200" ] || fail "${asset}: no responde 200"
  expect_header "$asset" Cache-Control "public, max-age=31536000, immutable"
fi

# Cabeceras de seguridad.
expect_present / Strict-Transport-Security
expect_header / X-Content-Type-Options "nosniff"

# El healthcheck del contenedor llega a «healthy».
cid="$(compose ps -q caddy)"
health="starting"
for _ in $(seq 1 60); do
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}sin-healthcheck{{end}}' "$cid")"
  [ "$health" = "healthy" ] && break
  sleep 2
done
[ "$health" = "healthy" ] || fail "el contenedor caddy no llegó a healthy (estado: ${health})"

if [ "$failures" -gt 0 ]; then
  echo "${failures} comprobación(es) fallaron." >&2
  exit 1
fi
echo "Caddy: cabeceras y healthcheck correctos."
