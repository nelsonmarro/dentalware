#!/usr/bin/env bash
# Respaldo del laboratorio (#111): dump de Postgres, fotos y configuración en un repositorio de
# restic cifrado (en el VPS, la carpeta local /var/backups/dentalware/restic), con retención
# todo lo de 3 días + 7 diarios / 4 semanales / 12 mensuales. El dump del día queda además en
# $BACKUP_LOCAL_DIR/db.
#
# Uso: infra/backup/backup.sh (sin argumentos; lo programa systemd).
# Sale con 0 si respaldó, 75 si ya había un respaldo o una restauración en curso y otro código
# si falló. Con BACKUP_HEALTHCHECK_URL avisa el inicio, el éxito y el fallo (con las últimas
# líneas del log).
set -Eeuo pipefail

# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

load_config
require_vars POSTGRES_USER POSTGRES_DB RESTIC_REPOSITORY RESTIC_PASSWORD_FILE BACKUP_LOCAL_DIR

secure_local_dir

JOB_LOG=""
dump=""
cleanup() {
  rm -f "$JOB_LOG"
  [ -z "$dump" ] || rm -f "$dump.partial"
}
trap cleanup EXIT
job_log_start

take_lock "Respaldo omitido"
trap 'on_job_error "el respaldo" $LINENO' ERR

log "Respaldo de ${COMPOSE_PROJECT_NAME}: inicio."
use_healthcheck BACKUP_HEALTHCHECK_URL
hc_ping start

# Sin el volumen de adjuntos, docker crearía uno vacío y el respaldo saldría «correcto».
if ! docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1; then
  log "ERROR: no existe el volumen de adjuntos ${UPLOADS_VOLUME}."
  false
fi

dump="$BACKUP_LOCAL_DIR/db/dentalware-$(date +%F).dump"
log "Volcando la base de datos ${POSTGRES_DB}..."
compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc >"$dump.partial"
# Un dump vacío o ilegible no sustituye al bueno ni entra en el respaldo.
if [ ! -s "$dump.partial" ]; then
  log "ERROR: el dump salió vacío."
  false
fi
compose exec -T postgres pg_restore -l <"$dump.partial" >/dev/null
mv "$dump.partial" "$dump"
log "Dump listo: $(basename "$dump") ($(du -h "$dump" | cut -f1))."

# Configuración que hace falta para reconstruir este servidor, si existe y se puede leer.
config_mounts=()
add_config() {
  if [ -n "$1" ] && [ -r "$1" ]; then
    config_mounts+=(-v "$1:/backup/config/$2:ro")
  else
    log "Configuración: ${2} no existe o no se puede leer; no se respalda."
  fi
}
add_config "$ENV_FILE" .env
add_config "$INFRA_DIR/Caddyfile.vps" Caddyfile.vps
add_config "$INFRA_DIR/docker-compose.vps.yml" docker-compose.vps.yml
add_config /etc/nginx/sites-available/dentalware nginx-dentalware

log "Respaldando con restic..."
summary="$(restic_run \
  -v "$UPLOADS_VOLUME:/data/uploads:ro" \
  -v "$dump:/backup/db/$(basename "$dump"):ro" \
  "${config_mounts[@]}" \
  -- backup --quiet --json --tag diario --host "$COMPOSE_PROJECT_NAME" /data/uploads /backup)"
snapshot_id="$(grep -o '"snapshot_id":"[0-9a-f]*"' <<<"$summary" | cut -d'"' -f4 || true)"
data_added="$(grep -o '"data_added":[0-9]*' <<<"$summary" | cut -d: -f2 || true)"
if [ -z "$snapshot_id" ]; then
  log "ERROR: restic no devolvió el snapshot creado."
  false
fi
result="snapshot ${snapshot_id:0:8}, $(numfmt --to=iec-i --suffix=B "${data_added:-0}") añadidos"
log "Snapshot creado: ${result}."

log "Aplicando la retención (todo lo de ${KEEP_WITHIN}, ${KEEP_DAILY} diarios, ${KEEP_WEEKLY} semanales, ${KEEP_MONTHLY} mensuales)..."
restic_run -- forget --quiet --tag diario --host "$COMPOSE_PROJECT_NAME" --keep-within "$KEEP_WITHIN" \
  --keep-daily "$KEEP_DAILY" --keep-weekly "$KEEP_WEEKLY" --keep-monthly "$KEEP_MONTHLY" --prune
find "$BACKUP_LOCAL_DIR/db" -type f -name '*.dump' -mtime +"$LOCAL_KEEP_DAYS" -delete

log "Respaldo correcto: ${result}."
hc_ping ok "$result"
