#!/usr/bin/env bash
# Verificación semanal del repositorio de restic (#111): `restic check --read-data-subset=5%`
# comprueba la estructura del repositorio (índices, snapshots, árboles) y lee y descifra un 5 % de
# los paquetes de datos, elegidos al azar cada semana. No poda: la retención la aplica backup.sh.
#
# Uso: infra/backup/check.sh (sin argumentos; lo programa systemd los domingos).
# Sale con 0 si el repositorio está sano, 75 si había un respaldo, una restauración o un
# simulacro en curso, y otro código si encontró errores. Con BACKUP_CHECK_HEALTHCHECK_URL avisa
# el inicio, el éxito y el fallo (con las últimas líneas del log).
set -Eeuo pipefail

# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

load_config
require_vars RESTIC_REPOSITORY RESTIC_PASSWORD_FILE BACKUP_LOCAL_DIR

secure_local_dir

JOB_LOG=""
trap 'rm -f "$JOB_LOG"' EXIT
job_log_start

take_lock "Verificación omitida"
trap 'on_job_error "la verificación" $LINENO' ERR

log "Verificación del repositorio de restic: inicio."
use_healthcheck BACKUP_CHECK_HEALTHCHECK_URL
hc_ping start

log "Ejecutando restic check --read-data-subset=5%..."
restic_run -- check --read-data-subset=5%

log "Verificación correcta: el repositorio no tiene errores."
hc_ping ok "restic check --read-data-subset=5%: sin errores"
