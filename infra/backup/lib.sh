# shellcheck shell=bash
# Funciones comunes de los respaldos (#111): las cargan backup.sh, restore.sh, check.sh,
# drill.sh e install.sh con `source`.
#
# Configuración: infra/.env (o el archivo de DENTALWARE_ENV_FILE) y restic.env. Lo que ya está
# en el entorno manda sobre los dos, como en docker compose; así se respetan COMPOSE_FILE y
# COMPOSE_PROJECT_NAME (en el VPS, `docker-compose.yml:docker-compose.vps.yml`).
#
# Nunca se muestra un secreto: ni `set -x`, ni `echo` de contraseñas o URLs de aviso. Las
# variables de restic llegan al contenedor con `-e VAR` sin valor (heredadas del entorno).

# Todo lo que crean los scripts (dumps en claro, copias, carpetas de trabajo) es solo de quien
# respalda (root en el VPS): en el servidor corren otros servicios.
umask 077

BACKUP_SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$BACKUP_SCRIPTS_DIR")"

# Ruta de la contraseña de restic dentro de su contenedor.
RESTIC_PASSWORD_IN_CONTAINER=/run/secrets/restic-password

log() {
  printf '%s %s\n' "$(date -Is)" "$*"
}

die() {
  log "ERROR: $*" >&2
  exit 1
}

# load_env_file <archivo>: exporta cada VAR=valor que no esté ya en el entorno. Lee el archivo
# como datos (sin ejecutarlo) y quita las comillas que rodean el valor, como docker compose.
load_env_file() {
  local line key value
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in '' | '#'*) continue ;; esac
    key="${line%%=*}"
    value="${line#*=}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi
    [ -n "${!key+x}" ] || export "$key=$value"
  done <"$1"
}

# load_config: carga el .env (si existe) y restic.env, fija los valores por omisión y se mueve a
# infra/, donde docker compose busca sus archivos.
load_config() {
  ENV_FILE="${DENTALWARE_ENV_FILE:-$INFRA_DIR/.env}"
  if [ -f "$ENV_FILE" ]; then
    ENV_FILE="$(cd "$(dirname "$ENV_FILE")" && pwd)/$(basename "$ENV_FILE")"
    load_env_file "$ENV_FILE"
  else
    ENV_FILE=""
  fi
  load_env_file "$BACKUP_SCRIPTS_DIR/restic.env"
  export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-dentalware}"
  export COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
  # Volumen de adjuntos de docker compose: <proyecto>_uploads (en producción, dentalware_uploads).
  export UPLOADS_VOLUME="${COMPOSE_PROJECT_NAME}_uploads"
  cd "$INFRA_DIR" || die "no se puede entrar en ${INFRA_DIR}"
}

# require_vars VAR...: falla nombrando las que faltan, nunca su valor.
require_vars() {
  local missing=() var
  for var in "$@"; do
    [ -n "${!var:-}" ] || missing+=("$var")
  done
  [ "${#missing[@]}" -eq 0 ] ||
    die "faltan variables en ${ENV_FILE:-el entorno (no hay .env)}: ${missing[*]}"
}

# secure_local_dir: crea $BACKUP_LOCAL_DIR/db y deja la carpeta y db/ solo para su dueño (700),
# también si ya existían con otros permisos.
secure_local_dir() {
  mkdir -p "$BACKUP_LOCAL_DIR/db"
  chmod 700 "$BACKUP_LOCAL_DIR" "$BACKUP_LOCAL_DIR/db"
}

# take_lock <qué se omite>: un solo respaldo, restauración, verificación o simulacro a la vez (el
# mismo bloqueo para todos). Si ya hay uno en curso, lo dice y sale con 75 (EX_TEMPFAIL) sin
# tocar nada.
take_lock() {
  exec 9>"$BACKUP_LOCAL_DIR/.lock"
  if ! flock -n 9; then
    log "${1}: ya hay un respaldo o una restauración en curso."
    exit 75
  fi
}

compose() {
  [ -n "$ENV_FILE" ] || die "no hay .env: docker compose no sabría con qué levantar los servicios"
  docker compose --env-file "$ENV_FILE" "$@"
}

# restic_run [opciones de docker run...] -- <argumentos de restic>: restic en su contenedor, con
# el usuario que corre el script (root en el VPS), el repositorio montado si es una ruta y la
# contraseña montada de solo lectura.
restic_run() {
  local docker_args=()
  while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do
    docker_args+=("$1")
    shift
  done
  [ "${1:-}" = "--" ] && shift
  [ -r "$RESTIC_PASSWORD_FILE" ] || die "no se puede leer RESTIC_PASSWORD_FILE"
  if [[ "$RESTIC_REPOSITORY" == /* ]]; then
    docker_args+=(-v "$RESTIC_REPOSITORY:$RESTIC_REPOSITORY")
  fi
  docker_args+=(-v "$RESTIC_PASSWORD_FILE:$RESTIC_PASSWORD_IN_CONTAINER:ro")
  RESTIC_PASSWORD_FILE="$RESTIC_PASSWORD_IN_CONTAINER" RESTIC_CACHE_DIR=/tmp/restic-cache \
    docker run --rm --user "$(id -u):$(id -g)" \
    -e RESTIC_REPOSITORY -e RESTIC_PASSWORD_FILE -e RESTIC_CACHE_DIR \
    "${docker_args[@]}" "$RESTIC_IMAGE" "$@"
}

# job_log_start: la salida del script va a stdout (journald) y a un archivo temporal
# ($JOB_LOG), del que sale el resumen de un fallo para el aviso /fail. Quien lo llama borra
# $JOB_LOG al salir.
job_log_start() {
  JOB_LOG="$(mktemp)"
  exec > >(tee -a "$JOB_LOG") 2>&1
}

# on_job_error <qué> <línea>: trap de ERR de los trabajos programados (`set -E`). Dice qué falló
# y avisa /fail con las últimas líneas del log. Con `set -E`, el trap también salta dentro de una
# sustitución de comandos: ahí solo se sale, y avisa una sola vez el script, cuando la
# sustitución le devuelve el error.
on_job_error() {
  local code=$? what="$1" line="$2"
  [ "$BASH_SUBSHELL" -eq 0 ] || exit "$code"
  trap - ERR
  log "ERROR: ${what} falló (línea ${line}, código ${code})."
  hc_ping fail "$(tail -n 20 "$JOB_LOG")"
  exit "$code"
}

# use_healthcheck <VAR>: los avisos de este script (hc_ping) van a la URL de la variable <VAR>
# (cada trabajo tiene la suya). Vacía, lo dice en el log y no avisa a nadie (decisión 10).
use_healthcheck() {
  HEALTHCHECK_URL="${!1:-}"
  [ -n "$HEALTHCHECK_URL" ] || log "${1} vacía: sin avisos (el resultado queda solo en este log)."
}

# hc_ping start|ok|fail [texto]: aviso opcional (healthchecks.io u otro) a la URL que eligió
# use_healthcheck. Sin URL no hace nada. Un aviso que no llega no hace fallar el trabajo.
hc_ping() {
  local kind="$1" body="${2:-}" url="${HEALTHCHECK_URL:-}"
  url="${url%/}"
  [ -n "$url" ] || return 0
  case "$kind" in
    start) url="$url/start" ;;
    fail) url="$url/fail" ;;
    ok) ;;
    *) die "hc_ping: tipo de aviso desconocido: $kind" ;;
  esac
  if ! printf '%s' "$body" |
    curl -fsS -m 10 --retry 3 -o /dev/null --data-binary @- "$url" >/dev/null 2>&1; then
    log "Aviso: no se pudo enviar el aviso «${kind}»."
  fi
}

# uploads_owner: uid:gid con el que corre la API (dueño de los adjuntos en el volumen).
uploads_owner() {
  # shellcheck disable=SC2016 # se expande dentro del contenedor
  compose run --rm --no-deps -T --entrypoint sh api -c 'echo "$(id -u):$(id -g)"' 2>/dev/null |
    tail -n 1
}
