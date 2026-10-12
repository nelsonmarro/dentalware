#!/usr/bin/env bash
# Prueba de punta a punta de los respaldos (#111, PEM-3 #93): levanta Postgres y la API con un
# proyecto compose propio, crea datos por la API (con una foto), respalda con
# infra/backup/backup.sh, simula el desastre (`down -v`: se pierden la BD y los adjuntos),
# restaura con infra/backup/restore.sh y comprueba que todo vuelve: conteos, la foto byte a
# byte y servida por la API. Prueba además la restauración de un solo archivo, la de la
# configuración sin `.env` (pérdida total), el bloqueo ante dos respaldos a la vez, la
# retención de los dumps locales y los avisos opcionales (inicio, éxito y fallo).
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
outputs="$tmp/salidas.log"
hc_pid=""
failures=0

# Entorno hostil: lo que exporte quien corre la prueba (aquí, a propósito, otro proyecto y otro
# repositorio) nunca debe llegar a los scripts. Si llegara, respaldarían o restaurarían otra cosa.
no_tocar="$(dirname "$repo")/dw-no-tocar-$$"
export COMPOSE_PROJECT_NAME=dw-no-tocar COMPOSE_FILE=/no-existe/docker-compose.yml
export RESTIC_REPOSITORY="$no_tocar" RESTIC_PASSWORD_FILE=/no-existe/restic-password
export BACKUP_LOCAL_DIR="$no_tocar"

# shellcheck source-path=SCRIPTDIR source=../backup/restic.env
. "$root/infra/backup/restic.env"

compose() {
  docker compose -p "$project" -f "$root/infra/docker-compose.yml" -f "$tmp/override.yml" \
    --env-file "$tmp/.env" "$@"
}

cleanup() {
  [ -n "$hc_pid" ] && kill "$hc_pid" 2>/dev/null || true
  compose down -v --remove-orphans >/dev/null 2>&1 || true
  docker volume rm "${project}-otro_uploads" dw-no-tocar_uploads >/dev/null 2>&1 || true
  rm -rf "$tmp" "$repo" "$no_tocar"
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
    -u RESTIC_IMAGE -u HELPER_IMAGE -u KEEP_DAILY -u KEEP_WEEKLY -u KEEP_MONTHLY \
    -u LOCAL_KEEP_DAYS DENTALWARE_ENV_FILE="$env_file" "${assigns[@]}" "$@" 2>&1 |
    tee -a "$outputs"
}

# show <log>: el log de un script, sangrado, para leerlo en la salida de CI.
show() {
  sed 's/^/    | /' "$1"
}

# restic directo (sin lib.sh): la prueba mira el repositorio por su cuenta.
test_restic() {
  RESTIC_REPOSITORY=/repo RESTIC_PASSWORD_FILE=/run/secrets/restic-password \
    RESTIC_CACHE_DIR=/tmp/restic-cache docker run --rm --user "$(id -u):$(id -g)" \
    -e RESTIC_REPOSITORY -e RESTIC_PASSWORD_FILE -e RESTIC_CACHE_DIR \
    -v "$repo:/repo" -v "$tmp/restic-password:/run/secrets/restic-password:ro" \
    "$RESTIC_IMAGE" "$@"
}

snapshot_count() {
  test_restic snapshots --json | jq 'length'
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
echo "Desastre: se borran la BD y los adjuntos..."
compose down -v >/dev/null 2>&1
compose up -d --wait --wait-timeout 180 api >/dev/null 2>&1 || abort "la API no volvió a levantar tras el desastre"
[ -z "$(volume_sha "$storage_path")" ] || abort "el volumen de adjuntos no quedó vacío"

echo "Restaurando el último snapshot..."
if ! run_script "$tmp/.env" "$root/infra/backup/restore.sh" --snapshot latest >"$tmp/restore.log"; then
  cat "$tmp/restore.log" >&2
  abort "restore.sh falló"
fi
show "$tmp/restore.log"
safety_dump="$(find "$tmp/local/db" -name 'antes-de-restaurar-*.dump' | head -n 1)"
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
cat "$tmp/par1.log" "$tmp/par2.log" | grep -q 'ya hay un respaldo o una restauración en curso' ||
  fail "el respaldo bloqueado debe decir «ya hay un respaldo o una restauración en curso»"

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
grep -q 'en curso' "$tmp/restore-bloqueado.log" ||
  fail "la restauración bloqueada debe decir que hay un respaldo en curso"
[ "$(counts)" = "$counts_locked" ] || fail "la restauración bloqueada tocó la BD"

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

sed "s|^BACKUP_HEALTHCHECK_URL=.*|BACKUP_HEALTHCHECK_URL=${hc_url}|" "$tmp/.env" >"$tmp/hc.env"
: >"$tmp/hc.log"
run_script "$tmp/hc.env" "$root/infra/backup/backup.sh" >"$tmp/backup-hc.log" ||
  fail "el respaldo con avisos falló"
grep -q '^POST /ping/abc/start ' "$tmp/hc.log" || fail "no llegó el aviso de inicio (/start)"
grep -qE '^POST /ping/abc snapshot [0-9a-f]{8}' "$tmp/hc.log" ||
  fail "no llegó el aviso de éxito con el snapshot"
if grep -q '/fail' "$tmp/hc.log"; then fail "un respaldo correcto no debe avisar /fail"; fi
# Van tres respaldos correctos hoy. `restic forget` deja el último del día y, mientras no haya
# 7 días con respaldos, también el más antiguo («oldest daily snapshot», restic ≥ 0.17): 2.
[ "$(snapshot_count)" = "2" ] ||
  fail "tras tres respaldos del mismo día, la retención debe dejar 2 snapshots (hay $(snapshot_count))"

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

# --- Retención fijada -----------------------------------------------------------------------
[ "$KEEP_DAILY $KEEP_WEEKLY $KEEP_MONTHLY $LOCAL_KEEP_DAYS" = "7 4 12 3" ] ||
  fail "la retención debe ser 7 diarias, 4 semanales, 12 mensuales y 3 días de dumps locales"

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
