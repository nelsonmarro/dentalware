#!/usr/bin/env bash
# Prueba de punta a punta de los respaldos (#111, PEM-3 #93): levanta Postgres y la API con un
# proyecto compose propio, crea datos por la API (con una foto), respalda con
# infra/backup/backup.sh, simula el desastre (`down -v`: se pierden la BD y los adjuntos) y
# reconstruye sin arrancar (`create`, como la ruta B de recuperacion.md), restaura con
# infra/backup/restore.sh y comprueba que todo vuelve: conteos, la foto byte a byte y servida
# por la API. Una restauración que falla deja la API como estaba: parada si lo estaba (sobre la
# BD vacía no migra nada) y en marcha si corría. Prueba además la restauración de un solo archivo, la de la
# configuración sin `.env` (pérdida total), el bloqueo ante dos respaldos a la vez, la
# retención de los dumps locales y los avisos opcionales (inicio, éxito y fallo). Cubre también
# la verificación semanal (check.sh) y el simulacro mensual (drill.sh) contra este proyecto
# compose como «producción».
# Sin red externa: el repositorio de restic es una carpeta temporal y los avisos llegan a un
# servidor HTTP local.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
project="dw-backup-test"
image="dentalware-api:test"
port="${BACKUP_TEST_PORT:-13100}"
base="http://127.0.0.1:${port}"
tmp="$(mktemp -d)"
repo="$(mktemp -d "${TMPDIR:-/tmp}/dw-restic-XXXXXX")"
repo_vacio="$(mktemp -d "${TMPDIR:-/tmp}/dw-restic-vacio-XXXXXX")"
repo_dump_roto="$(mktemp -d "${TMPDIR:-/tmp}/dw-restic-dump-roto-XXXXXX")"
outputs="$tmp/salidas.log"
hc_pid=""
failures=0

# Entorno hostil: lo que exporte quien corre la prueba (aquí, a propósito, otro proyecto y otro
# repositorio) nunca debe llegar a los scripts. Si llegara, respaldarían o restaurarían otra cosa.
no_tocar="$(dirname "$repo")/dw-no-tocar-$$"
export COMPOSE_PROJECT_NAME=dw-no-tocar COMPOSE_FILE=/no-existe/docker-compose.yml
export RESTIC_REPOSITORY="$no_tocar" RESTIC_PASSWORD_FILE=/no-existe/restic-password
export BACKUP_LOCAL_DIR="$no_tocar"
export BACKUP_CHECK_HEALTHCHECK_URL=http://127.0.0.1:9/no-tocar
export BACKUP_DRILL_HEALTHCHECK_URL=http://127.0.0.1:9/no-tocar DRILL_SAMPLE=no-tocar/nada.jpg

# shellcheck source-path=SCRIPTDIR source=../backup/restic.env
. "$root/infra/backup/restic.env"

compose() {
  docker compose -p "$project" -f "$root/infra/docker-compose.yml" -f "$tmp/override.yml" \
    --env-file "$tmp/.env" "$@"
}

cleanup() {
  if [ -n "$hc_pid" ]; then kill "$hc_pid" 2>/dev/null || true; fi
  compose down -v --remove-orphans >/dev/null 2>&1 || true
  docker volume rm "${project}-otro_uploads" dw-no-tocar_uploads >/dev/null 2>&1 || true
  docker rm -f dw-drill-pg-999999 >/dev/null 2>&1 || true
  docker network rm dw-drill-net-999999 >/dev/null 2>&1 || true
  docker volume rm dw-drill-data-999999 >/dev/null 2>&1 || true
  rm -rf "$tmp" "$repo" "$repo_vacio" "$repo_dump_roto" "$no_tocar"
}
trap cleanup EXIT

fail() {
  echo "FALLA: $*" >&2
  failures=$((failures + 1))
}

abort() {
  echo "FALLA: $*" >&2
  echo "La prueba no puede seguir." >&2
  exit 1
}

# Entorno propio y desechable: ningún secreto real. Como en el VPS, el `.env` dice el proyecto
# y los archivos de compose, y los scripts los respetan.
mkdir -p "$tmp/local"
openssl rand -hex 32 >"$tmp/restic-password"
chmod 600 "$tmp/restic-password"
{
  echo "COMPOSE_PROJECT_NAME=${project}"
  echo "COMPOSE_FILE=${root}/infra/docker-compose.yml:${tmp}/override.yml"
  echo "PUBLIC_URL=${base}"
  echo "DOCS_PUBLIC_URL=${base}"
  echo "SITE_ADDRESS=:80"
  echo "POSTGRES_USER=dw"
  echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
  echo "POSTGRES_DB=dw"
  echo "BETTER_AUTH_SECRET=$(openssl rand -hex 24)"
  echo "ADMIN_EMAIL=prueba@example.com"
  echo "ADMIN_PASSWORD=$(openssl rand -hex 24)"
  echo "ADMIN_NAME=Prueba"
  echo "RESTIC_REPOSITORY=${repo}"
  echo "RESTIC_PASSWORD_FILE=${tmp}/restic-password"
  echo "BACKUP_HEALTHCHECK_URL="
  echo "BACKUP_LOCAL_DIR=${tmp}/local"
} >"$tmp/.env"
chmod 600 "$tmp/.env"

cat >"$tmp/override.yml" <<YML
services:
  api:
    image: ${image}
    pull_policy: never
    build: !reset null
    restart: 'no'
    ports:
      - '127.0.0.1:${port}:3000'
  postgres:
    restart: 'no'
YML

env_value() {
  sed -n "s/^$1=//p" "$tmp/.env"
}
admin_email="$(env_value ADMIN_EMAIL)"
admin_password="$(env_value ADMIN_PASSWORD)"

# run_script <.env> [VAR=valor...] <script> [args...]: corre un script de respaldo con el `.env`
# de la prueba y sin nada del entorno de quien la corre (las VAR=valor se inyectan a propósito).
# Su salida queda también en $outputs para comprobar al final que nunca muestra un secreto.
run_script() {
  local env_file="$1" assigns=()
  shift
  while [[ "${1:-}" =~ ^[A-Z_]+= ]]; do
    assigns+=("$1")
    shift
  done
  env -u COMPOSE_PROJECT_NAME -u COMPOSE_FILE -u RESTIC_REPOSITORY -u RESTIC_PASSWORD_FILE \
    -u POSTGRES_USER -u POSTGRES_DB -u BACKUP_LOCAL_DIR -u BACKUP_HEALTHCHECK_URL \
    -u BACKUP_CHECK_HEALTHCHECK_URL -u BACKUP_DRILL_HEALTHCHECK_URL -u DRILL_SAMPLE \
    -u RESTIC_IMAGE -u HELPER_IMAGE -u KEEP_WITHIN -u KEEP_DAILY -u KEEP_WEEKLY -u KEEP_MONTHLY \
    -u LOCAL_KEEP_DAYS DENTALWARE_ENV_FILE="$env_file" "${assigns[@]}" "$@" 2>&1 |
    tee -a "$outputs"
}

# show <log>: el log de un script, sangrado, para leerlo en la salida de CI.
show() {
  sed 's/^/    | /' "$1"
}

# restic directo (sin lib.sh): la prueba mira el repositorio ($TEST_REPO, por omisión $repo)
# por su cuenta.
test_restic() {
  local test_repo="${TEST_REPO:-$repo}"
  RESTIC_REPOSITORY=/repo RESTIC_PASSWORD_FILE=/run/secrets/restic-password \
    RESTIC_CACHE_DIR=/tmp/restic-cache docker run --rm --user "$(id -u):$(id -g)" \
    -e RESTIC_REPOSITORY -e RESTIC_PASSWORD_FILE -e RESTIC_CACHE_DIR \
    -v "$test_repo:/repo" -v "$tmp/restic-password:/run/secrets/restic-password:ro" \
    "$RESTIC_IMAGE" "$@"
}

snapshot_count() {
  test_restic snapshots --json | jq 'length'
}

# old_snapshot <"AAAA-MM-DD HH:MM:SS" (UTC)>: un snapshot con fecha pasada, del mismo grupo que
# los de backup.sh (host, etiqueta y rutas), para probar la retención sobre días anteriores.
old_snapshot() {
  mkdir -p "$tmp/backup-viejo"
  RESTIC_REPOSITORY=/repo RESTIC_PASSWORD_FILE=/run/secrets/restic-password \
    RESTIC_CACHE_DIR=/tmp/restic-cache docker run --rm --user "$(id -u):$(id -g)" \
    -e RESTIC_REPOSITORY -e RESTIC_PASSWORD_FILE -e RESTIC_CACHE_DIR \
    -v "$repo:/repo" -v "$tmp/restic-password:/run/secrets/restic-password:ro" \
    -v "${project}_uploads:/data/uploads:ro" -v "$tmp/backup-viejo:/backup:ro" \
    "$RESTIC_IMAGE" backup --quiet --tag diario --host "$project" --time "$1" /data/uploads /backup
}

# snapshot_times: la hora (UTC, «AAAA-MM-DD HH:MM») de cada snapshot, ordenadas.
snapshot_times() {
  test_restic snapshots --json | jq -r '.[].time' | cut -c1-16 | tr T ' ' | sort
}

# snapshots_since <epoch>: cuántos snapshots hay de ese momento en adelante.
snapshots_since() {
  local n=0 t
  while IFS= read -r t; do
    [ "$(date -d "$t" +%s)" -lt "$1" ] || n=$((n + 1))
  done < <(test_restic snapshots --json | jq -r '.[].time')
  echo "$n"
}

psql_value() {
  compose exec -T postgres psql -U dw -d dw -tAc "$1"
}

counts() {
  psql_value "select (select count(*) from cases) || ' ' || (select count(*) from clinics) || ' ' || (select count(*) from attachments)"
}

volume_sha() {
  docker run --rm -v "${project}_uploads:/data:ro" "$HELPER_IMAGE" sha256sum "/data/$1" 2>/dev/null |
    cut -d' ' -f1
}

# --- API: sesión de admin y datos ----------------------------------------------------------
jar="$tmp/cookies"

login() {
  rm -f "$jar"
  local status
  status="$(jq -n --arg e "$admin_email" --arg p "$admin_password" '{email: $e, password: $p}' |
    curl -s -o "$tmp/resp" -w '%{http_code}' -c "$jar" -H 'Content-Type: application/json' \
      -H "Origin: ${base}" --data-binary @- "${base}/api/auth/sign-in/email")"
  [ "$status" = "200" ] || abort "el login del admin respondió ${status}: $(cat "$tmp/resp")"
}

# post_json <ruta> <json>: deja el cuerpo en $tmp/resp y aborta si no es 2xx.
post_json() {
  local status
  status="$(curl -s -o "$tmp/resp" -w '%{http_code}' -b "$jar" -H 'Content-Type: application/json' \
    -H "Origin: ${base}" --data-binary "$2" "${base}$1")"
  case "$status" in
    2*) ;;
    *) abort "POST $1 respondió ${status}: $(cat "$tmp/resp")" ;;
  esac
}

get_json() {
  curl -sf -b "$jar" "${base}$1" || abort "GET $1 falló"
}

suffix="$(date +%s)-${RANDOM}"

create_clinic() {
  post_json /api/config/clinicas "$(jq -n --arg n "Clínica respaldo $1" '{name: $n}')"
  jq -r '.clinic.id' "$tmp/resp"
}

echo "Construyendo la imagen de la API (puede tardar unos minutos)..."
docker build -q -f "$root/infra/api.Dockerfile" -t "$image" "$root" >/dev/null

echo "Levantando Postgres y la API..."
compose up -d --wait --wait-timeout 180 api >/dev/null 2>&1 || abort "la API no llegó a healthy"
compose run --rm --no-deps api node dist/scripts/seed.js >/dev/null 2>&1 || abort "el seed falló"

echo "Iniciando el repositorio de restic..."
test_restic init >/dev/null || abort "restic init falló"

# Un respaldo de la BD recién creada, aún sin trabajos, en otro repositorio: el simulacro sobre él
# debe fallar (un respaldo sin datos no prueba nada).
echo "Respaldando la BD vacía en otro repositorio..."
TEST_REPO="$repo_vacio" test_restic init >/dev/null || abort "restic init del repositorio vacío falló"
sed "s|^RESTIC_REPOSITORY=.*|RESTIC_REPOSITORY=${repo_vacio}|" "$tmp/.env" >"$tmp/vacio.env"
if ! run_script "$tmp/vacio.env" "$root/infra/backup/backup.sh" >"$tmp/backup-vacio.log"; then
  cat "$tmp/backup-vacio.log" >&2
  abort "backup.sh de la BD vacía falló"
fi

echo "Creando datos por la API..."
login
clinic_id="$(create_clinic "$suffix")"
post_json /api/config/doctores \
  "$(jq -n --arg c "$clinic_id" --arg n "Dr. respaldo $suffix" '{clinicId: $c, name: $n}')"
doctor_id="$(jq -r '.doctor.id' "$tmp/resp")"
category_id="$(get_json /api/config/productos/categorias | jq -r '.categories[0].id')"
post_json /api/config/productos "$(jq -n --arg c "$category_id" --arg code "R${suffix: -10}" \
  '{code: $code, name: "Producto respaldo", categoryId: $c, pricingUnit: "por_pieza",
    basePrice: "25.00", turnaroundDays: 5, requiresTryIn: false}')"
product_id="$(jq -r '.product.id' "$tmp/resp")"
post_json /api/trabajos "$(jq -n --arg c "$clinic_id" --arg d "$doctor_id" --arg p "$product_id" \
  --arg today "$(TZ=America/Guayaquil date +%F)" \
  '{clinicId: $c, doctorId: $d, patientRef: "Paciente respaldo", receivedAt: $today,
    prescription: "Corona", items: [{productId: $p, quantity: 1, teeth: [11], unitPrice: null,
    discountPct: 0}]}')"
case_id="$(jq -r '.case.id' "$tmp/resp")"

status="$(curl -s -o "$tmp/resp" -w '%{http_code}' -b "$jar" -H "Origin: ${base}" \
  -F "file=@${root}/apps/web/e2e/fixtures/foto.png;type=image/png" \
  "${base}/api/adjuntos/trabajo/${case_id}")"
[ "$status" = "201" ] || abort "subir la foto respondió ${status}: $(cat "$tmp/resp")"
attachment_id="$(jq -r '.attachment.id' "$tmp/resp")"
storage_path="$(psql_value "select storage_path from attachments where id = '${attachment_id}'")"
counts_before="$(counts)"
sha_before="$(volume_sha "$storage_path")"
size_before="$(psql_value "select size from attachments where id = '${attachment_id}'")"
[ -n "$sha_before" ] || abort "la foto no está en el volumen (${storage_path})"
echo "Datos: trabajos, clínicas y adjuntos = ${counts_before}; foto ${storage_path}"

# Dumps locales: uno de hace 5 días se borra (más de LOCAL_KEEP_DAYS) y uno de ayer se queda.
mkdir -p "$tmp/local/db"
touch -d '5 days ago' "$tmp/local/db/dentalware-viejo.dump"
touch -d '1 day ago' "$tmp/local/db/dentalware-ayer.dump"

# --- Respaldo ------------------------------------------------------------------------------
# Los snapshots de esta corrida son los posteriores a este momento (no «los de hoy» por fecha UTC,
# que fallaría si la prueba cruzara la medianoche UTC).
run_start="$(date +%s)"
echo "Respaldando..."
if ! run_script "$tmp/.env" "$root/infra/backup/backup.sh" >"$tmp/backup1.log"; then
  cat "$tmp/backup1.log" >&2
  abort "backup.sh falló"
fi
show "$tmp/backup1.log"
[ "$(snapshot_count)" = "1" ] || fail "tras el respaldo debe haber 1 snapshot (hay $(snapshot_count))"
grep -q 'sin avisos' "$tmp/backup1.log" ||
  fail "con BACKUP_HEALTHCHECK_URL vacía, el log debe decir que no avisa («sin avisos»)"
grep -qE 'snapshot [0-9a-f]{8}' "$tmp/backup1.log" || fail "el log no da el id del snapshot"
[ -e "$tmp/local/db/dentalware-$(date +%F).dump" ] ||
  fail "no quedó el dump del día en BACKUP_LOCAL_DIR/db"
[ ! -e "$tmp/local/db/dentalware-viejo.dump" ] || fail "el dump de hace 5 días debía borrarse"
[ -e "$tmp/local/db/dentalware-ayer.dump" ] || fail "el dump de ayer debía quedarse"
# El dump es la BD entera sin cifrar: solo lo lee quien respalda (root en el VPS).
[ "$(stat -c %a "$tmp/local/db/dentalware-$(date +%F).dump")" = "600" ] ||
  fail "el dump del día debe quedar con permisos 600"
[ "$(stat -c %a "$tmp/local") $(stat -c %a "$tmp/local/db")" = "700 700" ] ||
  fail "BACKUP_LOCAL_DIR y su db/ deben quedar con permisos 700"
test_restic ls latest --json | jq -r 'select(.path) | .path' >"$tmp/ls.txt"
grep -qx '/backup/config/.env' "$tmp/ls.txt" || fail "el respaldo no incluye el .env"
grep -q "^/data/uploads/${storage_path}$" "$tmp/ls.txt" || fail "el respaldo no incluye la foto"
grep -qE '^/backup/db/dentalware-[0-9-]+\.dump$' "$tmp/ls.txt" || fail "el respaldo no incluye el dump"

# --- Desastre y restauración ----------------------------------------------------------------
# Como la ruta B de recuperacion.md: todo se pierde y se reconstruye sin arrancar (`create`),
# para que la API no cree un esquema vacío antes de restaurar.
echo "Desastre: se borran la BD y los adjuntos, y se reconstruye sin arrancar..."
compose down -v >/dev/null 2>&1
compose create postgres api >/dev/null 2>&1 || abort "compose create falló tras el desastre"
[ -z "$(compose ps --status running -q)" ] || abort "tras compose create no debe correr ningún servicio"
[ -z "$(volume_sha "$storage_path")" ] || abort "el volumen de adjuntos no quedó vacío"

# api_running: el id del contenedor de la API si está en marcha (vacío si no).
api_running() {
  compose ps --status running -q api
}

# Un snapshot cuyo «dump» no lo es, en otro repositorio: restore.sh falla en pg_restore, después
# de parar la API.
mkdir -p "$tmp/dump-roto/backup/db" "$tmp/dump-roto/uploads/x"
printf 'no es un dump\n' >"$tmp/dump-roto/backup/db/dentalware-roto.dump"
printf 'x' >"$tmp/dump-roto/uploads/x/foto.jpg"
TEST_REPO="$repo_dump_roto" test_restic init >/dev/null || abort "restic init del repositorio roto falló"
RESTIC_REPOSITORY=/repo RESTIC_PASSWORD_FILE=/run/secrets/restic-password \
  RESTIC_CACHE_DIR=/tmp/restic-cache docker run --rm --user "$(id -u):$(id -g)" \
  -e RESTIC_REPOSITORY -e RESTIC_PASSWORD_FILE -e RESTIC_CACHE_DIR \
  -v "$repo_dump_roto:/repo" -v "$tmp/restic-password:/run/secrets/restic-password:ro" \
  -v "$tmp/dump-roto/uploads:/data/uploads:ro" -v "$tmp/dump-roto/backup:/backup:ro" \
  "$RESTIC_IMAGE" backup --quiet --tag diario --host "$project" /data/uploads /backup >/dev/null ||
  abort "no se pudo crear el snapshot con el dump roto"
sed "s|^RESTIC_REPOSITORY=.*|RESTIC_REPOSITORY=${repo_dump_roto}|" "$tmp/.env" >"$tmp/dump-roto.env"

# restore_broken <log>: restaura el snapshot del dump roto; debe fallar en pg_restore.
restore_broken() {
  if run_script "$tmp/dump-roto.env" "$root/infra/backup/restore.sh" >"$1"; then
    fail "restore.sh con un dump que no es un dump debe fallar"
  fi
  grep -q 'Restaurando la base de datos' "$1" ||
    abort "la restauración rota debía fallar en pg_restore, con la API ya parada: $(tail -n 5 "$1")"
}

echo "Restauración que falla, con la API parada..."
restore_broken "$tmp/restore-roto-parada.log"
show "$tmp/restore-roto-parada.log"
[ -z "$(api_running)" ] ||
  fail "una restauración que falla no debe arrancar la API si no estaba en marcha"
tables="$(psql_value "select count(*) from information_schema.tables where table_schema = 'public'")"
[ "$tables" = "0" ] ||
  fail "tras la restauración que falla, la BD vacía debe seguir vacía, sin migrar (${tables} tablas)"

echo "Restaurando el último snapshot..."
touch "$tmp/restore-inicio"
if ! run_script "$tmp/.env" "$root/infra/backup/restore.sh" --snapshot latest >"$tmp/restore.log"; then
  cat "$tmp/restore.log" >&2
  abort "restore.sh falló"
fi
show "$tmp/restore.log"
# La restauración rota de antes dejó la suya: solo cuenta la escrita por esta restauración.
safety_dump="$(find "$tmp/local/db" -name 'antes-de-restaurar-*.dump' -newer "$tmp/restore-inicio" | head -n 1)"
if [ -z "$safety_dump" ] || [ "$(stat -c %a "$safety_dump")" != "600" ]; then
  fail "la copia antes de restaurar debe existir con permisos 600"
fi
[ "$(counts)" = "$counts_before" ] ||
  fail "conteos tras restaurar: $(counts) (esperado ${counts_before})"
[ "$(volume_sha "$storage_path")" = "$sha_before" ] || fail "la foto restaurada no es la misma"
api_state="$(docker inspect -f '{{.State.Health.Status}}' "$(compose ps -q api)" 2>/dev/null || true)"
[ "$api_state" = "healthy" ] || fail "la API no quedó healthy tras restaurar (${api_state})"

login
served="$(curl -s -o /dev/null -w '%{http_code} %{size_download}' -b "$jar" \
  "${base}/api/adjuntos/${attachment_id}")"
status="${served% *}"
size="${served#* }"
[ "$status" = "200" ] || fail "GET /api/adjuntos/:id tras restaurar respondió ${status}"
[ "$size" = "$size_before" ] || fail "la foto servida mide ${size} bytes (esperado ${size_before})"
# La API sigue pudiendo escribir en las carpetas restauradas (dueño correcto en el volumen).
status="$(curl -s -o "$tmp/resp" -w '%{http_code}' -b "$jar" -H "Origin: ${base}" \
  -F "file=@${root}/apps/web/e2e/fixtures/foto.png;type=image/png" \
  "${base}/api/adjuntos/trabajo/${case_id}")"
[ "$status" = "201" ] || fail "subir otra foto al trabajo restaurado respondió ${status}: $(cat "$tmp/resp")"

echo "Restauración que falla, con la API en marcha..."
counts_running="$(counts)"
restore_broken "$tmp/restore-roto-marcha.log"
[ -n "$(api_running)" ] || fail "una restauración que falla debe volver a arrancar la API si estaba en marcha"
api_state=""
for _ in $(seq 1 90); do
  api_state="$(docker inspect -f '{{.State.Health.Status}}' "$(compose ps -q api)" 2>/dev/null || true)"
  [ "$api_state" = "healthy" ] && break
  sleep 2
done
[ "$api_state" = "healthy" ] || abort "la API no volvió a healthy tras la restauración que falla"
[ "$(counts)" = "$counts_running" ] || fail "la restauración que falla tocó la BD (conteos $(counts))"

# --- Solo archivos --------------------------------------------------------------------------
echo "Restaurando un solo archivo borrado..."
create_clinic "despues-$suffix" >/dev/null
counts_after_new="$(counts)"
docker run --rm -v "${project}_uploads:/data" "$HELPER_IMAGE" rm "/data/${storage_path}"
[ -z "$(volume_sha "$storage_path")" ] || abort "no se pudo borrar la foto del volumen"
if ! run_script "$tmp/.env" "$root/infra/backup/restore.sh" --snapshot latest \
  --solo-archivos "$storage_path" >"$tmp/restore-archivo.log"; then
  cat "$tmp/restore-archivo.log" >&2
  fail "restore.sh --solo-archivos falló"
fi
[ "$(volume_sha "$storage_path")" = "$sha_before" ] || fail "--solo-archivos no devolvió la foto"
[ "$(counts)" = "$counts_after_new" ] || fail "--solo-archivos tocó la BD (conteos $(counts))"
show "$tmp/restore-archivo.log"
status="$(curl -s -o /dev/null -w '%{http_code}' -b "$jar" "${base}/api/adjuntos/${attachment_id}")"
[ "$status" = "200" ] || fail "la foto restaurada sola respondió ${status}"
if run_script "$tmp/.env" "$root/infra/backup/restore.sh" --snapshot latest \
  --solo-archivos 'no-existe/nada.jpg' >"$tmp/restore-nada.log"; then
  fail "--solo-archivos con una ruta que no está en el respaldo debe fallar"
fi
grep -q 'casa con «no-existe/nada.jpg»' "$tmp/restore-nada.log" ||
  fail "--solo-archivos sin coincidencias debe decir que ningún adjunto casa con la ruta"

# Una ruta vacía es un error de uso (sale con 2): nunca restaura todo ni toca la BD.
for args in "--solo-archivos|" "--solo-archivos|/" "--solo-archivos|/data/uploads/" "--con-config|"; do
  option="${args%%|*}"
  rc=0
  run_script "$tmp/.env" "$root/infra/backup/restore.sh" --snapshot latest \
    "$option" "${args#*|}" >"$tmp/restore-vacio.log" || rc=$?
  [ "$rc" = "2" ] || fail "restore.sh ${option} «${args#*|}» debe salir con 2 (salió ${rc})"
  grep -q -- "${option} necesita" "$tmp/restore-vacio.log" ||
    fail "restore.sh ${option} «${args#*|}» debe decir qué le falta"
done
[ "$(counts)" = "$counts_after_new" ] || fail "una ruta vacía tocó la BD (conteos $(counts))"

# --- Configuración tras la pérdida total (sin .env) ----------------------------------------
echo "Recuperando la configuración sin .env..."
if ! run_script "$tmp/no-existe.env" RESTIC_REPOSITORY="$repo" \
  RESTIC_PASSWORD_FILE="$tmp/restic-password" "$root/infra/backup/restore.sh" --snapshot latest \
  --con-config "$tmp/revisar" >"$tmp/restore-config.log"; then
  cat "$tmp/restore-config.log" >&2
  fail "restore.sh --con-config falló"
fi
cmp -s "$tmp/revisar/.env" "$tmp/.env" || fail "--con-config no dejó el .env respaldado"
[ "$(stat -c %a "$tmp/revisar/.env" 2>/dev/null)" = "600" ] ||
  fail "el .env recuperado debe quedar con permisos 600"

# --- Dos respaldos a la vez -----------------------------------------------------------------
echo "Dos respaldos a la vez..."
run_script "$tmp/.env" "$root/infra/backup/backup.sh" >"$tmp/par1.log" &
p1=$!
run_script "$tmp/.env" "$root/infra/backup/backup.sh" >"$tmp/par2.log" &
p2=$!
rc1=0
rc2=0
wait "$p1" || rc1=$?
wait "$p2" || rc2=$?
codes="$(printf '%s\n' "$rc1" "$rc2" | sort -n | tr '\n' ' ')"
[ "$codes" = "0 75 " ] || fail "dos respaldos a la vez deben salir 0 y 75 (salieron ${rc1} y ${rc2})"
lock_message='ya hay otro trabajo de respaldo en curso (respaldo, restauración, verificación o simulacro)'
cat "$tmp/par1.log" "$tmp/par2.log" | grep -qF "$lock_message" ||
  fail "el respaldo bloqueado debe decir «${lock_message}»"

# --- Restauración durante un respaldo ------------------------------------------------------
echo "Restaurar con un respaldo en curso..."
counts_locked="$(counts)"
exec 8>"$tmp/local/.lock"
flock -n 8 || abort "la prueba no pudo tomar el bloqueo de los respaldos"
rc=0
run_script "$tmp/.env" "$root/infra/backup/restore.sh" --snapshot latest 8>&- \
  >"$tmp/restore-bloqueado.log" || rc=$?
exec 8>&-
[ "$rc" = "75" ] || fail "restaurar con un respaldo en curso debe salir con 75 (salió ${rc})"
grep -qF "$lock_message" "$tmp/restore-bloqueado.log" ||
  fail "la restauración bloqueada debe decir «${lock_message}»"
[ "$(counts)" = "$counts_locked" ] || fail "la restauración bloqueada tocó la BD"

# --- Verificación semanal (check.sh) ------------------------------------------------------
echo "Verificación del repositorio..."
if ! run_script "$tmp/.env" "$root/infra/backup/check.sh" >"$tmp/check.log"; then
  cat "$tmp/check.log" >&2
  fail "check.sh falló con el repositorio sano"
fi
show "$tmp/check.log"
grep -q 'read-data-subset=5%' "$tmp/check.log" || fail "check.sh debe leer el 5 % de los datos"
grep -q 'sin avisos' "$tmp/check.log" ||
  fail "con BACKUP_CHECK_HEALTHCHECK_URL vacía, check.sh debe decir que no avisa"

# Un repositorio al que le falta un paquete de datos no pasa la verificación.
cp -a "$repo" "$tmp/repo-roto"
pack="$(find "$tmp/repo-roto/data" -type f | head -n 1)"
[ -n "$pack" ] || abort "el repositorio no tiene paquetes de datos"
rm -f "$pack"
sed "s|^RESTIC_REPOSITORY=.*|RESTIC_REPOSITORY=${tmp}/repo-roto|" "$tmp/.env" >"$tmp/roto.env"
if run_script "$tmp/roto.env" "$root/infra/backup/check.sh" >"$tmp/check-roto.log"; then
  fail "check.sh debe fallar con un repositorio al que le falta un paquete"
fi
grep -q 'ERROR: la verificación falló' "$tmp/check-roto.log" ||
  fail "check.sh debe decir que la verificación falló: $(tail -n 5 "$tmp/check-roto.log")"
rm -rf "$tmp/repo-roto"

# --- Simulacro mensual (drill.sh) ---------------------------------------------------------
# Lo creado después del snapshot no está en él: el simulacro lo tiene en cuenta y pasa.
echo "Simulacro de recuperación..."
# Volúmenes sin contenedor de antes del simulacro: uno nuevo sería el PGDATA (anónimo) del Postgres
# temporal, una copia en claro de la BD.
docker volume ls -q --filter dangling=true | sort >"$tmp/volumenes-antes.txt"
# Restos de un simulacro matado (SIGKILL) a medias: el siguiente los barre.
docker network create --internal dw-drill-net-999999 >/dev/null
docker volume create dw-drill-data-999999 >/dev/null
docker run -d --name dw-drill-pg-999999 --network dw-drill-net-999999 \
  -v dw-drill-data-999999:/data "$HELPER_IMAGE" sleep 600 >/dev/null
mkdir -p "$tmp/local/simulacro.viejo"
create_clinic "tras-respaldo-$suffix" >/dev/null
counts_prod="$(counts)"
if ! run_script "$tmp/.env" "$root/infra/backup/drill.sh" >"$tmp/drill.log"; then
  cat "$tmp/drill.log" >&2
  fail "drill.sh falló con el respaldo sano"
fi
show "$tmp/drill.log"
grep -q 'Simulacro correcto' "$tmp/drill.log" || fail "drill.sh debe terminar con «Simulacro correcto»"
grep -q 'sin avisos' "$tmp/drill.log" ||
  fail "con BACKUP_DRILL_HEALTHCHECK_URL vacía, drill.sh debe decir que no avisa"
grep -qE 'adjuntos comprobados: [1-5]\b' "$tmp/drill.log" ||
  fail "drill.sh debe decir cuántos adjuntos comprobó"
[ "$(counts)" = "$counts_prod" ] || fail "el simulacro tocó la BD de producción (conteos $(counts))"

# drill_leftovers: contenedores, redes o carpetas de trabajo que el simulacro dejó.
drill_leftovers() {
  docker ps -aq --filter name=dw-drill
  docker network ls -q --filter name=dw-drill
  docker volume ls -q --filter name=dw-drill
  docker volume ls -q --filter dangling=true | sort | comm -13 "$tmp/volumenes-antes.txt" -
  find "$tmp/local" -mindepth 1 -maxdepth 1 -name 'simulacro.*'
}
old_leftovers="$(docker ps -aq --filter name=dw-drill-pg-999999
  docker network ls -q --filter name=dw-drill-net-999999
  docker volume ls -q --filter name=dw-drill-data-999999
  find "$tmp/local" -maxdepth 1 -name simulacro.viejo)"
[ -z "$old_leftovers" ] ||
  fail "el simulacro no barrió los restos de uno interrumpido: $(tr '\n' ' ' <<<"$old_leftovers")"
[ -z "$(drill_leftovers)" ] || fail "el simulacro dejó restos: $(drill_leftovers | tr '\n' ' ')"

# Con una muestra que apunta a un adjunto que no está, el simulacro falla y lo nombra.
if run_script "$tmp/.env" DRILL_SAMPLE="no-existe/nada.jpg" "$root/infra/backup/drill.sh" \
  >"$tmp/drill-falta.log"; then
  fail "drill.sh debe fallar si un adjunto de la muestra no está en lo restaurado"
fi
grep -q 'no-existe/nada.jpg' "$tmp/drill-falta.log" ||
  fail "drill.sh debe nombrar el adjunto que falta: $(tail -n 5 "$tmp/drill-falta.log")"
[ -z "$(drill_leftovers)" ] || fail "el simulacro fallido dejó restos: $(drill_leftovers | tr '\n' ' ')"
# La misma muestra con un adjunto que sí está pasa.
run_script "$tmp/.env" DRILL_SAMPLE="$storage_path" "$root/infra/backup/drill.sh" \
  >"$tmp/drill-muestra.log" || fail "drill.sh con DRILL_SAMPLE=${storage_path} debe pasar"

# Si producción tiene filas de antes del snapshot que no están en él, el respaldo está incompleto.
psql_value "insert into clinics (name, created_at) values ('Clínica antigua ${suffix}', '2000-01-01')" \
  >/dev/null
if run_script "$tmp/.env" "$root/infra/backup/drill.sh" >"$tmp/drill-menos.log"; then
  fail "drill.sh debe fallar si el respaldo tiene menos clínicas que producción antes del snapshot"
fi
grep -q 'clinics' "$tmp/drill-menos.log" ||
  fail "drill.sh debe nombrar la tabla con menos filas: $(tail -n 5 "$tmp/drill-menos.log")"
psql_value "delete from clinics where name = 'Clínica antigua ${suffix}'" >/dev/null

# Un respaldo sin trabajos no sirve de simulacro.
if run_script "$tmp/vacio.env" "$root/infra/backup/drill.sh" >"$tmp/drill-vacio.log"; then
  fail "drill.sh debe fallar con un respaldo sin trabajos"
fi
grep -q 'no tiene filas en cases' "$tmp/drill-vacio.log" ||
  fail "drill.sh debe decir que el respaldo no tiene trabajos: $(tail -n 5 "$tmp/drill-vacio.log")"
[ -z "$(drill_leftovers)" ] || fail "el simulacro fallido dejó restos: $(drill_leftovers | tr '\n' ' ')"

# Con un respaldo o una restauración en curso, ni la verificación ni el simulacro corren.
exec 8>"$tmp/local/.lock"
flock -n 8 || abort "la prueba no pudo tomar el bloqueo de los respaldos"
for script in check.sh drill.sh; do
  rc=0
  run_script "$tmp/.env" "$root/infra/backup/$script" 8>&- >"$tmp/bloqueado.log" || rc=$?
  [ "$rc" = "75" ] || fail "${script} con un respaldo en curso debe salir con 75 (salió ${rc})"
  grep -qF "$lock_message" "$tmp/bloqueado.log" || fail "${script} bloqueado debe decir «${lock_message}»"
done
exec 8>&-

# --- El entorno manda sobre el .env (COMPOSE_PROJECT_NAME) --------------------------------
echo "Proyecto de compose desde el entorno..."
if run_script "$tmp/.env" COMPOSE_PROJECT_NAME="${project}-otro" \
  "$root/infra/backup/backup.sh" >"$tmp/backup-otro.log"; then
  fail "con un proyecto sin volumen de adjuntos, backup.sh debe fallar"
fi
grep -q "no existe el volumen de adjuntos ${project}-otro_uploads" "$tmp/backup-otro.log" ||
  fail "COMPOSE_PROJECT_NAME del entorno debe mandar y el respaldo debe parar sin su volumen"

# --- Avisos opcionales ----------------------------------------------------------------------
echo "Avisos: inicio, éxito y fallo..."
cat >"$tmp/hc.py" <<'PY'
import http.server, sys

log_path, port_path = sys.argv[1], sys.argv[2]

class Handler(http.server.BaseHTTPRequestHandler):
    def _handle(self):
        length = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(length).decode('utf-8', 'replace').replace('\n', ' | ')
        with open(log_path, 'a') as log:
            log.write(f'{self.command} {self.path} {body}\n')
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'OK')

    do_GET = do_POST = do_HEAD = _handle

    def log_message(self, *args):
        pass

server = http.server.HTTPServer(('127.0.0.1', 0), Handler)
with open(port_path, 'w') as f:
    f.write(str(server.server_address[1]))
server.serve_forever()
PY
python3 "$tmp/hc.py" "$tmp/hc.log" "$tmp/hc.port" &
hc_pid=$!
for _ in $(seq 1 50); do [ -s "$tmp/hc.port" ] && break; sleep 0.1; done
hc_url="http://127.0.0.1:$(cat "$tmp/hc.port")/ping/abc"

# Retención sobre días anteriores: dos snapshots el mismo día de hace 20 días y uno de hace 30.
old_day="$(date -u -d '20 days ago' +%F)"
oldest_day="$(date -u -d '30 days ago' +%F)"
old_snapshot "${old_day} 01:00:00" >/dev/null || abort "no se pudo crear el snapshot viejo de las 01:00"
old_snapshot "${old_day} 02:00:00" >/dev/null || abort "no se pudo crear el snapshot viejo de las 02:00"
old_snapshot "${oldest_day} 03:00:00" >/dev/null || abort "no se pudo crear el snapshot de hace 30 días"

sed "s|^BACKUP_HEALTHCHECK_URL=.*|BACKUP_HEALTHCHECK_URL=${hc_url}|" "$tmp/.env" >"$tmp/hc.env"
: >"$tmp/hc.log"
run_script "$tmp/hc.env" "$root/infra/backup/backup.sh" >"$tmp/backup-hc.log" ||
  fail "el respaldo con avisos falló"
grep -q '^POST /ping/abc/start ' "$tmp/hc.log" || fail "no llegó el aviso de inicio (/start)"
grep -qE '^POST /ping/abc snapshot [0-9a-f]{8}' "$tmp/hc.log" ||
  fail "no llegó el aviso de éxito con el snapshot"
if grep -q '/fail' "$tmp/hc.log"; then fail "un respaldo correcto no debe avisar /fail"; fi
# Van tres respaldos correctos hoy. Lo de los últimos KEEP_WITHIN (3 días) se conserva entero: un
# respaldo a mano durante el día nunca borra el de las 03:00.
snapshot_times >"$tmp/snapshots.txt"
run_count="$(snapshots_since "$run_start")"
[ "$run_count" = "3" ] ||
  fail "tras tres respaldos del mismo día deben quedar los 3 snapshots de la corrida (quedan ${run_count})"
# Antes de esa ventana manda 7/4/12: del día de hace 20 días queda solo el último, así que
# `restic forget` corre. El de hace 30 días se queda (último de su día y de su semana).
! grep -qx "${old_day} 01:00" "$tmp/snapshots.txt" ||
  fail "la retención debe borrar el snapshot de las 01:00 de hace 20 días (no es el último del día)"
grep -qx "${old_day} 02:00" "$tmp/snapshots.txt" ||
  fail "la retención debe conservar el último snapshot de hace 20 días"
grep -qx "${oldest_day} 03:00" "$tmp/snapshots.txt" ||
  fail "la retención debe conservar el snapshot de hace 30 días"

sed 's|^POSTGRES_DB=.*|POSTGRES_DB=no_existe|' "$tmp/hc.env" >"$tmp/hc-fail.env"
: >"$tmp/hc.log"
if run_script "$tmp/hc-fail.env" "$root/infra/backup/backup.sh" >"$tmp/backup-fail.log"; then
  fail "con una BD que no existe, backup.sh debe salir con error"
fi
grep -q '^POST /ping/abc/start ' "$tmp/hc.log" || fail "el respaldo fallido no avisó el inicio"
grep -q '^POST /ping/abc/fail .*no_existe' "$tmp/hc.log" ||
  fail "no llegó /fail con las últimas líneas del log"
[ "$(grep -c '/fail' "$tmp/hc.log")" = "1" ] || fail "un fallo de pg_dump debe avisar /fail una sola vez"

# Un fallo dentro de una sustitución de comandos (restic con otra contraseña) avisa una sola vez.
openssl rand -hex 32 >"$tmp/otra-password"
chmod 600 "$tmp/otra-password"
sed "s|^RESTIC_PASSWORD_FILE=.*|RESTIC_PASSWORD_FILE=${tmp}/otra-password|" "$tmp/hc.env" \
  >"$tmp/hc-restic.env"
: >"$tmp/hc.log"
if run_script "$tmp/hc-restic.env" "$root/infra/backup/backup.sh" >"$tmp/backup-restic.log"; then
  fail "con otra contraseña de restic, backup.sh debe salir con error"
fi
[ "$(grep -c '/fail' "$tmp/hc.log")" = "1" ] ||
  fail "un fallo de restic debe avisar /fail una sola vez (llegaron $(grep -c '/fail' "$tmp/hc.log"))"

# La verificación y el simulacro avisan a su propia URL, nunca a la del respaldo.
hc_base="${hc_url%/ping/abc}"
{
  cat "$tmp/hc.env"
  echo "BACKUP_CHECK_HEALTHCHECK_URL=${hc_base}/ping/check"
  echo "BACKUP_DRILL_HEALTHCHECK_URL=${hc_base}/ping/drill"
} >"$tmp/hc-jobs.env"
: >"$tmp/hc.log"
run_script "$tmp/hc-jobs.env" "$root/infra/backup/check.sh" >"$tmp/check-hc.log" ||
  fail "check.sh con avisos falló"
grep -q '^POST /ping/check/start ' "$tmp/hc.log" || fail "check.sh no avisó el inicio en su URL"
grep -q '^POST /ping/check ' "$tmp/hc.log" || fail "check.sh no avisó el éxito en su URL"
run_script "$tmp/hc-jobs.env" "$root/infra/backup/drill.sh" >"$tmp/drill-hc.log" ||
  fail "drill.sh con avisos falló"
grep -q '^POST /ping/drill/start ' "$tmp/hc.log" || fail "drill.sh no avisó el inicio en su URL"
grep -qE '^POST /ping/drill .*trabajos' "$tmp/hc.log" || fail "drill.sh no avisó el éxito con los conteos"
if grep -qE '/ping/abc|/fail' "$tmp/hc.log"; then
  fail "check.sh y drill.sh correctos no deben avisar a la URL del respaldo ni /fail: $(cat "$tmp/hc.log")"
fi
: >"$tmp/hc.log"
if run_script "$tmp/hc-jobs.env" DRILL_SAMPLE="no-existe/nada.jpg" "$root/infra/backup/drill.sh" \
  >"$tmp/drill-hc-fail.log"; then
  fail "drill.sh con un adjunto que falta debe fallar"
fi
[ "$(grep -c '^POST /ping/drill/fail .*no-existe/nada.jpg' "$tmp/hc.log")" = "1" ] ||
  fail "un simulacro fallido debe avisar /fail una sola vez, con el adjunto que falta: $(cat "$tmp/hc.log")"

# --- Un respaldo al que le faltan adjuntos ---------------------------------------------------
# Se borra una foto del volumen y otra cambia de tamaño; el respaldo siguiente queda incompleto
# y el simulacro (con su muestra al azar, que aquí abarca todos los adjuntos) lo detecta.
echo "Simulacro con adjuntos que faltan en el respaldo..."
other_path="$(psql_value "select storage_path from attachments where storage_path <> '${storage_path}' limit 1")"
[ -n "$other_path" ] || abort "no hay una segunda foto para la prueba"
attachments_total="$(psql_value "select count(*) from attachments")"
[ "$attachments_total" -le 5 ] ||
  abort "hay ${attachments_total} adjuntos: la muestra al azar del simulacro (5) no los abarcaría todos"
docker run --rm -v "${project}_uploads:/data" "$HELPER_IMAGE" \
  sh -c "rm '/data/${storage_path}' && printf x >'/data/${other_path}'"
run_script "$tmp/.env" "$root/infra/backup/backup.sh" >"$tmp/backup-incompleto.log" ||
  fail "el respaldo con adjuntos que faltan falló"
if run_script "$tmp/.env" "$root/infra/backup/drill.sh" >"$tmp/drill-incompleto.log"; then
  fail "drill.sh debe fallar si faltan adjuntos en el respaldo"
fi
grep -q "falta.*${storage_path}" "$tmp/drill-incompleto.log" ||
  fail "drill.sh debe decir qué adjunto falta: $(tail -n 8 "$tmp/drill-incompleto.log")"
grep -q "Adjuntos comprobados: ${attachments_total}\." "$tmp/drill-incompleto.log" ||
  fail "el simulacro debe comprobar los ${attachments_total} adjuntos (muestra de 5)"
grep -q "${other_path}.*mide 1 bytes" "$tmp/drill-incompleto.log" ||
  fail "drill.sh debe decir qué adjunto no mide lo que dice la BD: $(tail -n 8 "$tmp/drill-incompleto.log")"
[ -z "$(drill_leftovers)" ] || fail "el simulacro fallido dejó restos: $(drill_leftovers | tr '\n' ' ')"

# --- Retención fijada -----------------------------------------------------------------------
[ "$KEEP_WITHIN $KEEP_DAILY $KEEP_WEEKLY $KEEP_MONTHLY $LOCAL_KEEP_DAYS" = "3d 7 4 12 3" ] ||
  fail "la retención debe ser todo lo de 3 días, 7 diarias, 4 semanales, 12 mensuales y 3 días de dumps locales"
grep -qx 'DRILL_SAMPLE_SIZE=5' "$root/infra/backup/drill.sh" ||
  fail "el simulacro debe comprobar 5 adjuntos al azar (DRILL_SAMPLE_SIZE=5)"

# --- El entorno de quien corre la prueba no llegó a los scripts ----------------------------
[ ! -e "$no_tocar" ] || fail "un script usó RESTIC_REPOSITORY o BACKUP_LOCAL_DIR del entorno"
if [ -n "$(docker ps -aq --filter label=com.docker.compose.project=dw-no-tocar)" ] ||
  docker volume inspect dw-no-tocar_uploads >/dev/null 2>&1; then
  fail "un script usó COMPOSE_PROJECT_NAME del entorno"
fi

# --- Ningún secreto en los logs -------------------------------------------------------------
for key in POSTGRES_PASSWORD BETTER_AUTH_SECRET ADMIN_PASSWORD; do
  if grep -qF "$(env_value "$key")" "$outputs"; then fail "un script mostró ${key} en su salida"; fi
done
if grep -qF "$(cat "$tmp/restic-password")" "$outputs"; then
  fail "un script mostró la contraseña de restic"
fi

if [ "$failures" -gt 0 ]; then
  echo "${failures} comprobación(es) fallaron." >&2
  exit 1
fi
echo "Respaldo y restauración: todo vuelve (BD, fotos y configuración)."
