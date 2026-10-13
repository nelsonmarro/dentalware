#!/usr/bin/env bash
# Simulacro mensual de recuperación (#111, PEM-3 #93): comprueba que el último respaldo de verdad
# sirve para recuperar el laboratorio, sin tocar producción.
#   1. Restaura el último snapshot en una carpeta temporal de $BACKUP_LOCAL_DIR.
#   2. Carga su dump en un Postgres desechable (la misma imagen que producción), en una red
#      interna propia y sin puertos en el host.
#   3. Comprueba que cases, clinics y attachments tienen filas y al menos tantas como tenía
#      producción al hacerse el dump (lo creado después no está; lo borrado después, sí). La hora
#      es la del propio dump («Archive created at»), anterior al snapshot de restic.
#   4. Comprueba que 5 adjuntos al azar del dump están en los archivos restaurados con el tamaño
#      que dice la BD.
# A producción solo la lee (docker compose exec postgres psql). Todo lo temporal (contenedor
# dw-drill-pg-*, red dw-drill-net-*, volumen dw-drill-data-* con los datos de Postgres y la
# carpeta con el dump y las fotos) se borra al terminar; lo que dejara un simulacro anterior
# interrumpido (SIGKILL, corte de luz) lo barre el siguiente al empezar.
#
# Uso: infra/backup/drill.sh (sin argumentos; lo programa systemd el día 1 de cada mes).
# DRILL_SAMPLE="<storage_path> ..." sustituye la muestra al azar (para probar el simulacro).
# Sale con 0 si pasó, 75 si había un respaldo, una restauración o una verificación en curso, y
# otro código si falló. Con BACKUP_DRILL_HEALTHCHECK_URL avisa el inicio, el éxito y el fallo
# (con las últimas líneas del log).
set -Eeuo pipefail

# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DRILL_SAMPLE_SIZE=5
DRILL_TABLES=(cases clinics attachments)

load_config
require_vars POSTGRES_USER POSTGRES_DB RESTIC_REPOSITORY RESTIC_PASSWORD_FILE BACKUP_LOCAL_DIR

secure_local_dir

JOB_LOG=""
work=""
pg_name="dw-drill-pg-$$"
net_name="dw-drill-net-$$"
# Los datos del Postgres temporal (la BD restaurada, en claro) van en volúmenes con nombre: la
# imagen declara VOLUME para ellos, y uno anónimo sobreviviría a `docker rm -f`.
data_volumes=()
cleanup() {
  docker rm -fv "$pg_name" >/dev/null 2>&1 || true
  docker network rm "$net_name" >/dev/null 2>&1 || true
  [ "${#data_volumes[@]}" -eq 0 ] || docker volume rm "${data_volumes[@]}" >/dev/null 2>&1 || true
  [ -z "$work" ] || rm -rf "$work"
  rm -f "$JOB_LOG"
}
trap cleanup EXIT
# Si systemd lo para (o Ctrl+C), sale por el trap de EXIT y no deja el contenedor ni el dump.
trap 'exit 143' TERM
trap 'exit 130' INT
job_log_start

take_lock "Simulacro omitido"
trap 'on_job_error "el simulacro" $LINENO' ERR

# Con el lock tomado no corre ningún otro simulacro: todo dw-drill-* que exista es de uno
# interrumpido, y lleva una copia en claro de la BD.
sweep_old_drills() {
  local old
  old="$(docker ps -aq --filter name=^dw-drill-pg-)"
  [ -z "$old" ] || xargs docker rm -fv <<<"$old" >/dev/null
  old="$(docker network ls -q --filter name=^dw-drill-net-)"
  [ -z "$old" ] || xargs docker network rm <<<"$old" >/dev/null
  old="$(docker volume ls -q --filter name=^dw-drill-data-)"
  [ -z "$old" ] || xargs docker volume rm <<<"$old" >/dev/null
  find "$BACKUP_LOCAL_DIR" -mindepth 1 -maxdepth 1 -name 'simulacro.*' -exec rm -rf {} +
}

log "Simulacro de recuperación de ${COMPOSE_PROJECT_NAME}: inicio."
sweep_old_drills
use_healthcheck BACKUP_DRILL_HEALTHCHECK_URL
hc_ping start

# --- 1. Restaurar el último snapshot ----------------------------------------------------------
snapshot_json="$(restic_run -- snapshots latest --json)"
snapshot_id="$(grep -o '"id":"[0-9a-f]*"' <<<"$snapshot_json" | head -n 1 | cut -d'"' -f4 || true)"
if [ -z "$snapshot_id" ]; then
  log "ERROR: el repositorio no tiene snapshots."
  false
fi
work="$(mktemp -d "$BACKUP_LOCAL_DIR/simulacro.XXXXXX")"
log "Restaurando el snapshot ${snapshot_id:0:8} en una carpeta temporal..."
restic_run -v "$work:/restore" -- restore "$snapshot_id" --target /restore
dumps=("$work"/backup/db/*.dump)
if [ "${#dumps[@]}" -ne 1 ] || [ ! -f "${dumps[0]}" ]; then
  log "ERROR: el snapshot ${snapshot_id:0:8} debe tener exactamente un dump en /backup/db."
  false
fi
if [ ! -d "$work/data/uploads" ]; then
  log "ERROR: el snapshot ${snapshot_id:0:8} no tiene la carpeta de adjuntos."
  false
fi

# --- 2. Postgres desechable con el dump ------------------------------------------------------
pg_container="$(compose ps -q postgres)"
if [ -z "$pg_container" ]; then
  log "ERROR: el Postgres de producción no está corriendo: no hay con qué comparar."
  false
fi
pg_image="$(docker inspect -f '{{.Config.Image}}' "$pg_container")"
log "Levantando un Postgres temporal (${pg_image}) sin puertos en el host..."
docker network create --internal "$net_name" >/dev/null
volume_paths="$(docker image inspect -f '{{range $path, $_ := .Config.Volumes}}{{println $path}}{{end}}' "$pg_image")"
volume_args=()
while IFS= read -r path; do
  [ -n "$path" ] || continue
  data_volumes+=("dw-drill-data-$$-${#data_volumes[@]}")
  volume_args+=(-v "${data_volumes[-1]}:${path}")
done <<<"$volume_paths"
# Contraseña de un solo uso: va por el entorno de `docker run`, nunca en la línea de órdenes, y
# sustituye a la de producción que cargó load_config.
POSTGRES_PASSWORD="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')" \
  docker run -d --rm --name "$pg_name" --network "$net_name" \
  -e POSTGRES_PASSWORD -e POSTGRES_USER="$POSTGRES_USER" -e POSTGRES_DB="$POSTGRES_DB" -e TZ=UTC \
  "${volume_args[@]}" "$pg_image" >/dev/null
# Por TCP dentro del contenedor: durante su arranque inicial solo escucha en el socket, y ahí
# pg_isready ya respondería antes de que esté listo.
ready=0
for _ in $(seq 1 90); do
  if docker exec "$pg_name" pg_isready -q -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" != 1 ]; then
  log "ERROR: el Postgres temporal no arrancó."
  false
fi

dump_time="$(docker exec -i "$pg_name" pg_restore -l <"${dumps[0]}" |
  sed -n 's/^;[[:space:]]*Archive created at //p')"
if [ -z "$dump_time" ]; then
  log "ERROR: no se pudo leer la hora del dump $(basename "${dumps[0]}")."
  false
fi
log "Cargando $(basename "${dumps[0]}") (hecho el ${dump_time})..."
docker exec -i "$pg_name" pg_restore --no-owner --exit-on-error --single-transaction \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" <"${dumps[0]}"

# drill_psql <sql>: consulta la BD restaurada. Con -v nombre=valor, el valor se usa en el SQL
# como :'nombre' (citado por psql).
drill_psql() {
  local sql="$1"
  shift
  printf '%s\n' "$sql" |
    docker exec -i "$pg_name" psql -X -q -v ON_ERROR_STOP=1 -tA "$@" -U "$POSTGRES_USER" -d "$POSTGRES_DB"
}

# prod_psql <sql> [-v nombre=valor...]: consulta (solo lectura) la BD de producción.
prod_psql() {
  local sql="$1"
  shift
  printf '%s\n' "$sql" |
    compose exec -T postgres psql -X -q -v ON_ERROR_STOP=1 -tA "$@" -U "$POSTGRES_USER" -d "$POSTGRES_DB"
}

# --- 3. Conteos frente a producción ----------------------------------------------------------
problems=0
declare -A restored_count
for table in "${DRILL_TABLES[@]}"; do
  restored="$(drill_psql "select count(*) from ${table}")"
  before="$(prod_psql "select count(*) from ${table} where created_at <= :'t'::timestamptz" -v "t=${dump_time}")"
  now="$(prod_psql "select count(*) from ${table}")"
  restored_count[$table]="$restored"
  if [ "$restored" -eq 0 ]; then
    log "ERROR: el respaldo no tiene filas en ${table}."
    problems=$((problems + 1))
  elif [ "$restored" -lt "$before" ]; then
    log "ERROR: ${table}: el respaldo tiene ${restored} filas y producción tenía ${before} al hacerse el dump."
    problems=$((problems + 1))
  else
    log "${table}: ${restored} filas restauradas (producción: ${before} al hacerse el dump, ${now} ahora)."
  fi
done

# --- 4. Adjuntos de la muestra en los archivos restaurados -----------------------------------
if [ -n "${DRILL_SAMPLE:-}" ]; then
  read -ra sample <<<"$DRILL_SAMPLE"
  log "Muestra de adjuntos fijada por DRILL_SAMPLE."
else
  sample_list="$(drill_psql "select storage_path from attachments order by random() limit ${DRILL_SAMPLE_SIZE}")"
  sample=()
  [ -z "$sample_list" ] || mapfile -t sample <<<"$sample_list"
fi
checked=0
for path in "${sample[@]}"; do
  expected="$(drill_psql "select size from attachments where storage_path = :'p'" -v "p=${path}")"
  file="$work/data/uploads/${path}"
  checked=$((checked + 1))
  if [ -z "$expected" ]; then
    log "ERROR: el adjunto ${path} no está en la BD restaurada."
    problems=$((problems + 1))
  fi
  if [ ! -f "$file" ]; then
    log "ERROR: falta en los archivos restaurados el adjunto ${path}."
    problems=$((problems + 1))
  elif [ -n "$expected" ] && [ "$(stat -c %s "$file")" != "$expected" ]; then
    log "ERROR: el adjunto ${path} mide $(stat -c %s "$file") bytes y la BD dice ${expected}."
    problems=$((problems + 1))
  fi
done
log "Adjuntos comprobados: ${checked}."

if [ "$problems" -gt 0 ]; then
  log "ERROR: el respaldo del snapshot ${snapshot_id:0:8} no sirve para recuperar: ${problems} problema(s)."
  false
fi

result="snapshot ${snapshot_id:0:8} (dump del ${dump_time}): ${restored_count[cases]} trabajos, ${restored_count[clinics]} clínicas, ${restored_count[attachments]} adjuntos; adjuntos comprobados: ${checked}"
log "Simulacro correcto: ${result}."
hc_ping ok "$result"
