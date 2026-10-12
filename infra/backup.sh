#!/usr/bin/env bash
# PROVISIONAL: lo sustituye infra/backup/backup.sh (restic). Se mantiene mientras el paso 12 de
# docs/operacion/despliegue.md lo programe en el VPS; se borra al pasar a los respaldos definitivos.
# Backup diario: dump de Postgres + tar de uploads, retención 14 días.
# Uso (cron en el VPS): 0 3 * * * /opt/dentalware/infra/backup.sh >> /var/log/dentalware-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"
set -a
# shellcheck source=/dev/null
source ./.env
set +a
DEST=${BACKUP_DIR:-/opt/dentalware-backups}
STAMP=$(date +%F_%H%M)
mkdir -p "$DEST"
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$DEST/db_$STAMP.dump"
docker run --rm -v dentalware_uploads:/data:ro -v "$DEST":/backup alpine \
  tar czf "/backup/uploads_$STAMP.tgz" -C /data .
find "$DEST" -type f -mtime +14 -delete
echo "$(date -Is) backup ok: db_$STAMP.dump uploads_$STAMP.tgz"
