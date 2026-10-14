#!/usr/bin/env bash
# Prueba de la imagen de la API (#23): construye la imagen, comprueba que es liviana y sin
# fuentes, y que arranca de punta a punta (Postgres efímero, migra, /api/health 200, seed).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
project="dw-api-test"
image="dentalware-api:test"
max_bytes="${API_IMAGE_MAX_BYTES:-367001600}" # 350 MB
port="${API_TEST_PORT:-13000}"
tmp="$(mktemp -d)"
failures=0

cleanup() {
  docker compose -p "$project" -f "$root/infra/docker-compose.yml" -f "$tmp/override.yml" \
    --env-file "$tmp/.env" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

fail() {
  echo "FALLA: $*" >&2
  failures=$((failures + 1))
}

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

# Usa la imagen recién construida y publica la API en un puerto libre del host.
cat >"$tmp/override.yml" <<YML
services:
  api:
    image: ${image}
    pull_policy: never
    build: !reset null
    ports:
      - '127.0.0.1:${port}:3000'
YML

compose() {
  docker compose -p "$project" -f "$root/infra/docker-compose.yml" -f "$tmp/override.yml" \
    --env-file "$tmp/.env" "$@"
}

echo "Construyendo la imagen de la API (puede tardar unos minutos)..."
docker build -f "$root/infra/api.Dockerfile" -t "$image" "$root"

size="$(docker image inspect -f '{{.Size}}' "$image")"
echo "Tamaño de la imagen: $((size / 1024 / 1024)) MB (máximo $((max_bytes / 1024 / 1024)) MB)"
[ "$size" -lt "$max_bytes" ] || fail "la imagen pesa $((size / 1024 / 1024)) MB y el máximo es $((max_bytes / 1024 / 1024)) MB"

# Sin fuentes ni configuración de build: solo lo que corre.
for path in /app/src /app/tsconfig.json /app/apps /app/tsconfig.base.json /app/packages; do
  if ! docker run --rm --entrypoint sh "$image" -c "test ! -e $path"; then
    fail "la imagen contiene ${path}"
  fi
done
docker run --rm --entrypoint sh "$image" -c 'test -f dist/main.js && test -d drizzle' ||
  fail "faltan dist/main.js o drizzle/ en la imagen"

echo "Levantando Postgres y la API..."
compose up -d --wait --wait-timeout 120 api || fail "la API no llegó a healthy"

status="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${port}/api/health" || true)"
[ "$status" = "200" ] || fail "/api/health respondió ${status} (esperado 200)"

# El seed corre dentro de la imagen.
if ! seed_out="$(compose run --rm --no-deps api node dist/scripts/seed.js 2>&1)"; then
  fail "el seed falló: ${seed_out}"
elif ! grep -q 'Admin creado' <<<"$seed_out"; then
  fail "el seed no dijo «Admin creado»: ${seed_out}"
fi

if [ "$failures" -gt 0 ]; then
  echo "${failures} comprobación(es) fallaron." >&2
  exit 1
fi
echo "Imagen de la API: liviana, sin fuentes, migra, responde y siembra."
