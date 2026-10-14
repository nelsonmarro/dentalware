#!/usr/bin/env bash
# Instala la programación de los respaldos (#111) en el VPS: respaldo diario, verificación
# semanal y simulacro mensual con timers de systemd. Idempotente: se repite sin riesgo tras cada
# actualización del repo (copia las unidades de nuevo y deja los timers activos).
#
# Uso: sudo infra/backup/install.sh [--init] [--dry-run]
#   --init     crea el repositorio de restic si no existe (solo la primera vez).
#   --dry-run  comprueba la configuración y dice lo que haría, sin tocar /etc ni pedir root.
#
# Pasos:
#   1. comprueba infra/.env (las variables de los respaldos) y la contraseña de restic
#      (RESTIC_PASSWORD_FILE, permisos 600); si falta algo, dice qué, nunca su valor;
#   2. crea BACKUP_LOCAL_DIR solo para root (700);
#   3. comprueba el acceso al repositorio con `restic snapshots`, o lo crea con `restic init`
#      si no existe y se pasó --init (sin --init, se detiene antes de activar nada);
#   4. copia las unidades de infra/backup/systemd/ a /etc/systemd/system, con @DENTALWARE_DIR@
#      sustituido por la ruta de este repo;
#   5. `systemctl daemon-reload` y `enable --now` de los tres timers;
#   6. muestra `systemctl list-timers 'dentalware-*'`.
set -Eeuo pipefail

# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

UNIT_DIR=/etc/systemd/system
TIMERS=(dentalware-backup.timer dentalware-backup-check.timer dentalware-restore-drill.timer)

usage() {
  sed -n '6,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

dry_run=0
init=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) dry_run=1 ;;
    --init) init=1 ;;
    -h | --help) usage; exit 0 ;;
    *) log "ERROR: opción desconocida: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if [ "$dry_run" = 1 ]; then
  log "Simulación (--dry-run): no se toca /etc, ni systemd, ni el repositorio."
elif [ "$(id -u)" != "0" ]; then
  die "hace falta root: ejecútalo con sudo infra/backup/install.sh (o prueba antes con --dry-run)"
fi

# run <orden...>: la ejecuta, o en simulación solo la dice.
run() {
  if [ "$dry_run" = 1 ]; then
    log "Haría: $*"
  else
    log "$*"
    "$@"
  fi
}

# cannot_check <ruta>: sin root, verdadero si alguna carpeta de la ruta no deja mirar dentro (en
# el VPS, /var/backups/dentalware y /etc/dentalware son solo de root). Así --dry-run no confunde
# «sin permiso» con «no existe».
cannot_check() {
  local dir
  [ "$(id -u)" != "0" ] || return 1
  dir="$(dirname "$1")"
  while [ ! -e "$dir" ] && [ "$dir" != "/" ]; do dir="$(dirname "$dir")"; done
  [ ! -x "$dir" ] || [ ! -r "$dir" ]
}

NO_ROOT_CHECK="no se puede comprobar sin root; ejecútalo con sudo"

# --- 1. Configuración ----------------------------------------------------------------------
load_config
[ -n "$ENV_FILE" ] ||
  die "falta ${DENTALWARE_ENV_FILE:-infra/.env}: cópialo de infra/.env.example y complétalo"
require_vars POSTGRES_USER POSTGRES_DB RESTIC_REPOSITORY RESTIC_PASSWORD_FILE BACKUP_LOCAL_DIR
[[ "$RESTIC_REPOSITORY" == /* ]] ||
  die "RESTIC_REPOSITORY debe ser una carpeta local con ruta absoluta (p. ej. /var/backups/dentalware/restic)"
if [ ! -f "$RESTIC_PASSWORD_FILE" ] && cannot_check "$RESTIC_PASSWORD_FILE"; then
  log "Aviso: RESTIC_PASSWORD_FILE: ${NO_ROOT_CHECK}."
else
  [ -f "$RESTIC_PASSWORD_FILE" ] ||
    die "no existe el archivo de RESTIC_PASSWORD_FILE: créalo con openssl rand -hex 32 y chmod 600"
  perms="$(stat -c %a "$RESTIC_PASSWORD_FILE")"
  [ "$perms" = "600" ] || [ "$perms" = "400" ] ||
    die "la contraseña de restic (RESTIC_PASSWORD_FILE) debe tener permisos 600 y tiene ${perms}: chmod 600"
  [ -s "$RESTIC_PASSWORD_FILE" ] || die "el archivo de RESTIC_PASSWORD_FILE está vacío"
fi
if [ "$dry_run" = 0 ]; then
  command -v docker >/dev/null || die "falta Docker: restic corre en un contenedor"
fi
log "Configuración completa en ${ENV_FILE}."

# Ruta del repo que va en las unidades: sin espacios ni caracteres que systemd o sed interpreten.
DENTALWARE_DIR="$(dirname "$INFRA_DIR")"
[[ "$DENTALWARE_DIR" =~ ^/[A-Za-z0-9._/-]+$ ]] ||
  die "la ruta del repo (${DENTALWARE_DIR}) solo puede tener letras, números, . _ - y /"

# --- 2. Carpeta de trabajo ------------------------------------------------------------------
run mkdir -p "$BACKUP_LOCAL_DIR"
run chmod 700 "$BACKUP_LOCAL_DIR"

# --- 3. Repositorio de restic --------------------------------------------------------------
if [ ! -f "$RESTIC_REPOSITORY/config" ] && cannot_check "$RESTIC_REPOSITORY/config"; then
  log "Haría: restic snapshots, o restic init con --init si no existe (${RESTIC_REPOSITORY}: ${NO_ROOT_CHECK})"
elif [ -f "$RESTIC_REPOSITORY/config" ]; then
  if [ "$dry_run" = 1 ]; then
    log "Haría: restic snapshots (comprobar el acceso al repositorio ${RESTIC_REPOSITORY})"
  else
    log "Comprobando el acceso al repositorio con restic snapshots..."
    restic_run -- snapshots --compact
  fi
elif [ "$init" = 1 ]; then
  if [ "$dry_run" = 1 ]; then
    log "Haría: restic init (crear el repositorio ${RESTIC_REPOSITORY})"
  else
    log "Creando el repositorio con restic init..."
    restic_run -- init
    log "Guarda la contraseña de restic en tu gestor de contraseñas: sin ella el repositorio no se lee."
  fi
else
  die "no existe el repositorio de restic en ${RESTIC_REPOSITORY}: si es la primera vez, vuelve a ejecutarlo con --init"
fi

# --- 4. Unidades ---------------------------------------------------------------------------
rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT
for unit in "$BACKUP_SCRIPTS_DIR"/systemd/*.service "$BACKUP_SCRIPTS_DIR"/systemd/*.timer; do
  name="$(basename "$unit")"
  dest="$UNIT_DIR/$name"
  sed "s|@DENTALWARE_DIR@|${DENTALWARE_DIR}|g" "$unit" >"$rendered"
  if [ "$dry_run" = 1 ]; then
    log "Haría: copiar ${name} a ${dest}$(sed -n 's/^ExecStart=/ (ExecStart=/p' "$rendered" | sed 's/$/)/')"
  elif [ -f "$dest" ] && cmp -s "$rendered" "$dest"; then
    log "${dest}: sin cambios."
  else
    install -m 644 "$rendered" "$dest"
    log "${dest}: instalada."
  fi
done

# --- 5 y 6. Timers -------------------------------------------------------------------------
run systemctl daemon-reload
run systemctl enable --now "${TIMERS[@]}"
run systemctl list-timers --all 'dentalware-*'
if [ "$dry_run" = 1 ]; then
  log "Simulación terminada: no se cambió nada."
else
  log "Listo. Logs: journalctl -u dentalware-backup (y -backup-check, -restore-drill)."
fi
