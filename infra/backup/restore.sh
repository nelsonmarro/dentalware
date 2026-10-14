#!/usr/bin/env bash
# Restauración desde el repositorio de restic (#111, PEM-3 #93).
#
# Uso:
#   infra/backup/restore.sh [--snapshot <id>|latest]
#       Restaura todo: para la API, reemplaza la base de datos con el dump del snapshot
#       (pg_restore --clean), copia las fotos al volumen de adjuntos y arranca la API. Antes
#       guarda un dump de la BD actual en $BACKUP_LOCAL_DIR/db. Si falla, deja la API como estaba.
#   infra/backup/restore.sh [--snapshot <id>|latest] --solo-archivos <ruta>
#       Devuelve al volumen solo los adjuntos que casan con <ruta> (relativa a la carpeta de
#       adjuntos, como `storage_path`; admite comodines de restic). No toca la base de datos.
#   infra/backup/restore.sh [--snapshot <id>|latest] --con-config <dir>
#       Deja la configuración respaldada (.env, Caddyfile.vps, ...) en <dir>, que debe estar
#       vacío o no existir, para revisarla. No sobrescribe la vigente ni toca nada más; funciona
#       sin .env si RESTIC_REPOSITORY y RESTIC_PASSWORD_FILE están en el entorno.
#
# Por omisión, el snapshot es `latest`. Respeta COMPOSE_PROJECT_NAME y COMPOSE_FILE.
# Un uso no válido (una ruta vacía, opciones que no se combinan) sale con 2 sin tocar nada.
# Con un respaldo o una restauración en curso sale con 75 sin tocar nada (--con-config solo lee).
set -Eeuo pipefail

# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

usage() {
  sed -n '4,19p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

# usage_error <texto>: error de uso, sale con 2 antes de tocar nada.
usage_error() {
  log "ERROR: $*" >&2
  exit 2
}

snapshot=latest
files_only=0
files_pattern=""
config_only=0
config_dir=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --snapshot) [ "$#" -ge 2 ] || usage; snapshot="$2"; shift 2 ;;
    --solo-archivos) [ "$#" -ge 2 ] || usage; files_only=1; files_pattern="$2"; shift 2 ;;
    --con-config) [ "$#" -ge 2 ] || usage; config_only=1; config_dir="$2"; shift 2 ;;
    -h | --help) usage ;;
    *) log "Opción desconocida: $1" >&2; usage ;;
  esac
done
[ -n "$snapshot" ] || usage_error "--snapshot necesita un id o latest"
if [ "$files_only" = 1 ] && [ "$config_only" = 1 ]; then
  usage_error "--solo-archivos y --con-config no se combinan"
fi
# Una ruta vacía nunca es «todo»: sin esta comprobación caería en la restauración completa.
if [ "$files_only" = 1 ]; then
  files_pattern="${files_pattern#/data/uploads}"
  while [[ "$files_pattern" == /* ]]; do files_pattern="${files_pattern#/}"; done
  [ -n "$files_pattern" ] ||
    usage_error "--solo-archivos necesita la ruta de un adjunto (como storage_path: <caseId>/<id>.jpg)"
fi
[ "$config_only" = 0 ] || [ -n "$config_dir" ] ||
  usage_error "--con-config necesita una carpeta nueva o vacía"

load_config
require_vars RESTIC_REPOSITORY RESTIC_PASSWORD_FILE

work_parent="${BACKUP_LOCAL_DIR:-${TMPDIR:-/tmp}}"
mkdir -p "$work_parent"
work="$(mktemp -d "$work_parent/restaurar.XXXXXX")"
# Tras un fallo, la API se vuelve a arrancar solo si estaba en marcha. En una recuperación sobre
# una BD vacía (API parada), arrancarla le crearía el esquema actual y la restauración siguiente
# fallaría con «already exists».
restart_api_on_failure=0
cleanup() {
  if [ "$restart_api_on_failure" = 1 ]; then
    log "Volviendo a arrancar la API tras el fallo..."
    compose up -d --no-deps api >/dev/null 2>&1 || log "ERROR: no se pudo arrancar la API."
  fi
  rm -rf "$work"
}
trap cleanup EXIT
# Con `set -E` el trap salta también en las sustituciones de comandos: se avisa solo una vez.
trap '[ "$BASH_SUBSHELL" -gt 0 ] || log "ERROR: la restauración falló (línea $LINENO)." >&2' ERR

# restic_restore [--include <patrón>...]: restaura el snapshot elegido en $work.
restic_restore() {
  log "Restaurando el snapshot ${snapshot}${2:+ (solo ${2})}..."
  restic_run -v "$work:/restore" -- restore "$snapshot" --target /restore "$@"
}

# copy_to_uploads <carpeta>: copia su contenido al volumen de adjuntos, con el dueño de la API.
copy_to_uploads() {
  local owner
  owner="$(uploads_owner)"
  [[ "$owner" =~ ^[0-9]+:[0-9]+$ ]] || die "no se pudo saber con qué usuario corre la API"
  docker run --rm -v "$UPLOADS_VOLUME:/data" -v "$1:/restore:ro" "$HELPER_IMAGE" \
    sh -c "cp -a /restore/. /data/ && chown -R $owner /data"
}

# --- Solo la configuración -----------------------------------------------------------------
if [ "$config_only" = 1 ]; then
  if [ -e "$config_dir" ] && [ -n "$(ls -A "$config_dir")" ]; then
    die "${config_dir} no está vacío: elige una carpeta nueva para no sobrescribir nada"
  fi
  restic_restore --include /backup/config
  [ -d "$work/backup/config" ] || die "el snapshot ${snapshot} no tiene configuración"
  mkdir -p "$config_dir"
  chmod 700 "$config_dir"
  cp -a "$work/backup/config/." "$config_dir/"
  log "Configuración en ${config_dir}: $(find "$config_dir" -mindepth 1 -printf '%f ')"
  log "Revísala y cópiala a mano a infra/ (y nginx) si corresponde."
  exit 0
fi

require_vars POSTGRES_USER POSTGRES_DB BACKUP_LOCAL_DIR
# El mismo bloqueo que backup.sh: nunca se restaura mientras se respalda, ni al revés.
secure_local_dir
take_lock "Restauración omitida"
docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1 ||
  die "no existe el volumen de adjuntos ${UPLOADS_VOLUME}: levanta antes los servicios (docker compose up -d)"

# --- Solo archivos -------------------------------------------------------------------------
if [ "$files_only" = 1 ]; then
  restic_restore --include "/data/uploads/${files_pattern}"
  restored=0
  if [ -d "$work/data/uploads" ]; then
    restored="$(find "$work/data/uploads" -type f | wc -l)"
  fi
  [ "$restored" -gt 0 ] || die "ningún adjunto del snapshot ${snapshot} casa con «${files_pattern}»"
  copy_to_uploads "$work/data/uploads"
  log "Restaurados ${restored} archivo(s) en ${UPLOADS_VOLUME}. La base de datos no se tocó."
  exit 0
fi

# --- Todo ----------------------------------------------------------------------------------
compose up -d --wait postgres
restic_restore
dumps=("$work"/backup/db/*.dump)
if [ "${#dumps[@]}" -ne 1 ] || [ ! -f "${dumps[0]}" ]; then
  die "el snapshot ${snapshot} debe tener exactamente un dump en /backup/db"
fi
[ -d "$work/data/uploads" ] || die "el snapshot ${snapshot} no tiene la carpeta de adjuntos"

mkdir -p "$BACKUP_LOCAL_DIR/db"
safety="$BACKUP_LOCAL_DIR/db/antes-de-restaurar-$(date +%F-%H%M%S).dump"
if compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc >"$safety" 2>/dev/null; then
  log "Copia de la base de datos actual, por si acaso: $(basename "$safety")."
else
  rm -f "$safety"
  log "Aviso: no se pudo copiar la base de datos actual; se sigue con la restauración."
fi

if [ -n "$(compose ps --status running -q api 2>/dev/null || true)" ]; then
  log "Parando la API..."
  restart_api_on_failure=1
else
  log "La API no está en marcha: si la restauración falla, se queda parada."
fi
compose stop api

log "Restaurando la base de datos ${POSTGRES_DB} desde $(basename "${dumps[0]}")..."
compose exec -T postgres pg_restore --clean --if-exists --no-owner --single-transaction \
  --exit-on-error -U "$POSTGRES_USER" -d "$POSTGRES_DB" <"${dumps[0]}"

log "Copiando los adjuntos a ${UPLOADS_VOLUME}..."
copy_to_uploads "$work/data/uploads"

log "Arrancando la API..."
compose up -d --no-deps --wait --wait-timeout 180 api
restart_api_on_failure=0
log "Restauración completa desde el snapshot ${snapshot}."
