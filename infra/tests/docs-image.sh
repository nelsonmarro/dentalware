#!/usr/bin/env bash
# Prueba de la imagen del manual (Iteración 8): construye infra/docs.Dockerfile, la levanta en
# un puerto libre (como detrás del nginx del VPS) y comprueba que sirve el sitio, las cabeceras
# de caché y de seguridad, y que llega a «healthy».
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
project="dw-docs-test"
port="${DOCS_TEST_PORT:-18081}"
base="http://127.0.0.1:${port}"
tmp="$(mktemp -d)"
failures=0

cleanup() {
  docker compose -p "$project" -f "$root/infra/docker-compose.yml" -f "$tmp/override.yml" \
    --env-file "$tmp/.env" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

{
  echo "PUBLIC_URL=http://127.0.0.1:${port}"
  echo "DOCS_PUBLIC_URL=http://127.0.0.1:${port}"
  echo "SITE_ADDRESS=:80"
  echo "DOCS_SITE_ADDRESS=:80"
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
  docs:
    ports: !override
      - '127.0.0.1:${port}:80'
YML

compose() {
  docker compose -p "$project" -f "$root/infra/docker-compose.yml" -f "$tmp/override.yml" \
    --env-file "$tmp/.env" "$@"
}
fail() { echo "FALLA: $*" >&2; failures=$((failures + 1)); }
header_of() {
  curl -sI "${base}$1" | tr -d '\r' | awk -v h="$2" 'tolower($1) == tolower(h) ":" { sub(/^[^:]*: */, ""); print }'
}
status_of() { curl -s -o /dev/null -w '%{http_code}' "${base}$1"; }
expect_header() {
  local path="$1" name="$2" expected="$3" actual
  actual="$(header_of "$path" "$name")"
  [ "$actual" = "$expected" ] || fail "${path}: ${name} esperado «${expected}», llegó «${actual}»"
}

echo "Construyendo y levantando el manual (puede tardar unos minutos)..."
compose up -d --build --no-deps docs

for _ in $(seq 1 60); do
  [ "$(status_of /)" = "200" ] && break
  sleep 1
done

# Las páginas del manual: portada y una guía de cada sección de MAN-1.
for path in / /primeros-pasos/entrar-y-salir/ /recepcion/ /mensajero/; do
  [ "$(status_of "$path")" = "200" ] || fail "${path}: no responde 200"
  expect_header "$path" Cache-Control "no-cache"
done
# Una página que no existe es 404, no la portada.
[ "$(status_of /no-existe/)" = "404" ] || fail "/no-existe/: debe responder 404"
# Los assets con hash son inmutables.
asset="$(curl -s "${base}/" | grep -oE '/assets/[^"]+\.js' | head -n 1 || true)"
if [ -z "$asset" ]; then
  fail "la portada no enlaza ningún archivo de /assets/"
else
  [ "$(status_of "$asset")" = "200" ] || fail "${asset}: no responde 200"
  expect_header "$asset" Cache-Control "public, max-age=31536000, immutable"
fi
# Las capturas se sirven.
captura="$(curl -s "${base}/primeros-pasos/entrar-y-salir/" | grep -oE '/img/capturas/[^"]+\.png' | head -n 1 || true)"
if [ -z "$captura" ]; then
  fail "la guía /primeros-pasos/entrar-y-salir/ no enlaza ninguna captura"
else
  [ "$(status_of "$captura")" = "200" ] || fail "${captura}: no responde 200"
fi
# Cabeceras de seguridad.
[ "$(header_of / Strict-Transport-Security | grep -c .)" = "1" ] || fail "/: falta Strict-Transport-Security"
expect_header / X-Content-Type-Options "nosniff"
# Healthy.
cid="$(compose ps -q docs)"
health="starting"
for _ in $(seq 1 60); do
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}sin-healthcheck{{end}}' "$cid")"
  [ "$health" = "healthy" ] && break
  sleep 2
done
[ "$health" = "healthy" ] || fail "el contenedor docs no llegó a healthy (estado: ${health})"

if [ "$failures" -gt 0 ]; then
  echo "${failures} comprobación(es) fallaron." >&2
  exit 1
fi
echo "Manual: la imagen sirve el sitio con sus cabeceras y llega a healthy."
