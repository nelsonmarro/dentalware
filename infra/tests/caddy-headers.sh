#!/usr/bin/env bash
# Prueba de punta a punta del Caddy de producción (#19): construye la imagen web, levanta solo
# Caddy con SITE_ADDRESS=:80 (como detrás del nginx del VPS) en un puerto libre del host y
# comprueba las cabeceras de caché y de seguridad, y que el contenedor llega a «healthy». Valida
# además, con ese mismo Caddy, el Caddyfile.vps generado con el comando del paso 6.2 de
# docs/operacion/despliegue.md (el del repo con `trusted_proxies` delante).
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

# API de mentira con la cabecera de caché que pone la real en los adjuntos.
cat >"$tmp/api.conf" <<'CONF'
server {
  listen 3000;
  location / {
    add_header Cache-Control "private, max-age=86400";
    return 200 "ok";
  }
}
CONF

cat >"$tmp/override.yml" <<YML
services:
  fake-api:
    image: nginx:alpine
    volumes:
      - ${tmp}/api.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      default:
        aliases: [api]
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

# header_of <ruta> <cabecera>: valor de cada aparición de la cabecera, una por línea
# (vacío si no está). Una cabecera duplicada da dos líneas y no pasa las comprobaciones.
header_of() {
  curl -sI "${base}$1" | tr -d '\r' | awk -v h="$2" 'tolower($1) == tolower(h) ":" { sub(/^[^:]*: */, ""); print }'
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
  local count
  count="$(header_of "$path" "$name" | grep -c . || true)"
  if [ "$count" != "1" ]; then
    fail "${path}: la cabecera ${name} debe aparecer exactamente una vez (apareció ${count})"
  fi
}

echo "Construyendo y levantando Caddy (puede tardar unos minutos)..."
compose up -d --build --no-deps caddy fake-api

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

# Caddy no toca la caché de /api: llega la de la API, una sola vez.
[ "$(status_of /api/adjuntos/x)" = "200" ] || fail "/api/adjuntos/x: no llegó a la API"
expect_header /api/adjuntos/x Cache-Control "private, max-age=86400"

# Un asset que no existe es 404, no el index.html con caché inmutable.
[ "$(status_of /assets/no-existe-123.js)" = "404" ] || fail "/assets/no-existe-123.js: debe responder 404"

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

# El Caddyfile.vps del VPS, generado con el comando literal de despliegue.md (paso 6.2), en una
# copia de /opt/dentalware: Caddy lo acepta y se fía de los proxies privados (el nginx de delante).
vps_cmd="$(grep -m 1 -F "trusted_proxies static private_ranges" "$root/docs/operacion/despliegue.md" || true)"
if [ -z "$vps_cmd" ]; then
  fail "despliegue.md no tiene el comando que genera infra/Caddyfile.vps (paso 6.2)"
else
  mkdir -p "$tmp/vps/infra"
  cp "$root/infra/Caddyfile" "$tmp/vps/infra/Caddyfile"
  (cd "$tmp/vps" && bash -euo pipefail -c "$vps_cmd") || fail "el comando del paso 6.2 falló: ${vps_cmd}"
  compose exec -T caddy sh -c 'cat >/tmp/Caddyfile.vps' <"$tmp/vps/infra/Caddyfile.vps"
  if ! compose exec -T caddy caddy validate --adapter caddyfile --config /tmp/Caddyfile.vps \
    >"$tmp/validate.log" 2>&1; then
    fail "Caddy no acepta el Caddyfile.vps del paso 6.2: $(grep -m 1 -i error "$tmp/validate.log" ||
      tail -n 1 "$tmp/validate.log")"
  fi
  compose exec -T caddy caddy adapt --adapter caddyfile --config /tmp/Caddyfile.vps \
    >"$tmp/vps.json" 2>/dev/null || true
  jq -e '[.apps.http.servers[].trusted_proxies | select(.source == "static")
    | .ranges | index("192.168.0.0/16")] | length > 0' "$tmp/vps.json" >/dev/null 2>&1 ||
    fail "el Caddyfile.vps no se fía de los proxies privados (trusted_proxies static private_ranges)"
fi

if [ "$failures" -gt 0 ]; then
  echo "${failures} comprobación(es) fallaron." >&2
  exit 1
fi
echo "Caddy: cabeceras y healthcheck correctos."
