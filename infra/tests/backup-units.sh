#!/usr/bin/env bash
# Prueba de la programación de los respaldos (#111): las unidades de systemd de
# infra/backup/systemd/ (con la ruta del repo sustituida) pasan `systemd-analyze verify`, sus
# horarios son los acordados y `systemd-analyze calendar` los entiende en la hora de Guayaquil;
# e infra/backup/install.sh --dry-run comprueba la configuración (nombra lo que falta, nunca un
# valor) y dice lo que haría sin tocar /etc ni pedir root. Sin Docker ni red.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
units_dir="$root/infra/backup/systemd"
install_sh="$root/infra/backup/install.sh"
tmp="$(mktemp -d)"
failures=0

cleanup() {
  rm -rf "$tmp"
}
trap cleanup EXIT

fail() {
  echo "FALLA: $*" >&2
  failures=$((failures + 1))
}

services=(dentalware-backup dentalware-backup-check dentalware-restore-drill)
scripts=(backup.sh check.sh drill.sh)

# unit_value <archivo> <clave>: el valor de una clave de la unidad (la última, si se repite).
unit_value() {
  sed -n "s/^$2=//p" "$1" | tail -n 1
}

# --- Las seis unidades existen --------------------------------------------------------------
for name in "${services[@]}"; do
  for kind in service timer; do
    [ -f "$units_dir/$name.$kind" ] || fail "falta la unidad ${name}.${kind}"
  done
done
if [ "$failures" -gt 0 ]; then
  echo "${failures} comprobación(es) fallaron." >&2
  exit 1
fi

# --- Servicios: oneshot, en infra/, con Nice=10 y su script ---------------------------------
for i in "${!services[@]}"; do
  unit="$units_dir/${services[$i]}.service"
  [ "$(unit_value "$unit" Type)" = "oneshot" ] || fail "${services[$i]}.service debe ser Type=oneshot"
  [ "$(unit_value "$unit" WorkingDirectory)" = "@DENTALWARE_DIR@/infra" ] ||
    fail "${services[$i]}.service debe correr en @DENTALWARE_DIR@/infra"
  [ "$(unit_value "$unit" Nice)" = "10" ] || fail "${services[$i]}.service debe llevar Nice=10"
  [ "$(unit_value "$unit" ExecStart)" = "@DENTALWARE_DIR@/infra/backup/${scripts[$i]}" ] ||
    fail "${services[$i]}.service debe ejecutar infra/backup/${scripts[$i]}"
done
[ "$(unit_value "$units_dir/dentalware-backup.service" TimeoutStartSec)" = "2h" ] ||
  fail "dentalware-backup.service debe llevar TimeoutStartSec=2h"

# --- Timers: horarios acordados y Persistent=true -------------------------------------------
expected_calendar=(
  '*-*-* 03:00:00 America/Guayaquil'
  'Sun *-*-* 05:00:00 America/Guayaquil'
  '*-*-01 05:30:00 America/Guayaquil'
)
# Hora UTC a la que corresponde cada uno (Ecuador continental es UTC-5 todo el año).
expected_utc=('08:00:00' '10:00:00' '10:30:00')
for i in "${!services[@]}"; do
  timer="$units_dir/${services[$i]}.timer"
  calendar="$(unit_value "$timer" OnCalendar)"
  [ "$calendar" = "${expected_calendar[$i]}" ] ||
    fail "${services[$i]}.timer: OnCalendar=${calendar} (esperado ${expected_calendar[$i]})"
  [ "$(unit_value "$timer" Persistent)" = "true" ] ||
    fail "${services[$i]}.timer debe llevar Persistent=true (corre al arrancar si el VPS estaba apagado)"
  [ "$(unit_value "$timer" WantedBy)" = "timers.target" ] ||
    fail "${services[$i]}.timer debe instalarse en timers.target"
  if ! systemd-analyze calendar --iterations=2 "$calendar" >"$tmp/calendar.txt" 2>&1; then
    fail "systemd-analyze calendar no entiende «${calendar}»: $(cat "$tmp/calendar.txt")"
  elif ! grep -A1 'Next elapse' "$tmp/calendar.txt" | grep -q "${expected_utc[$i]} UTC"; then
    fail "${services[$i]}.timer debe correr a las ${expected_utc[$i]} UTC: $(cat "$tmp/calendar.txt")"
  fi
done
[ "$(unit_value "$units_dir/dentalware-backup.timer" RandomizedDelaySec)" = "10m" ] ||
  fail "dentalware-backup.timer debe llevar RandomizedDelaySec=10m"

# --- systemd-analyze verify con la ruta del repo sustituida --------------------------------
mkdir -p "$tmp/units"
for file in "$units_dir"/*.service "$units_dir"/*.timer; do
  sed "s|@DENTALWARE_DIR@|${root}|g" "$file" >"$tmp/units/$(basename "$file")"
done
if grep -rq '@DENTALWARE_DIR@' "$tmp/units"; then fail "quedó @DENTALWARE_DIR@ sin sustituir"; fi
if ! (cd "$tmp/units" && systemd-analyze verify ./*.service ./*.timer) >"$tmp/verify.txt" 2>&1; then
  fail "systemd-analyze verify falló: $(cat "$tmp/verify.txt")"
elif grep -q "$tmp/units" "$tmp/verify.txt"; then
  # Avisos sobre nuestras unidades (claves desconocidas, rutas que no existen...).
  fail "systemd-analyze verify avisa sobre las unidades: $(cat "$tmp/verify.txt")"
fi

# --- install.sh --dry-run -------------------------------------------------------------------
# Configuración de prueba: un repositorio de restic «existente» (con su config) y la contraseña.
secret="$(openssl rand -hex 24)"
mkdir -p "$tmp/repo" "$tmp/etc"
: >"$tmp/repo/config"
printf '%s\n' "$secret" >"$tmp/etc/restic-password"
chmod 600 "$tmp/etc/restic-password"
write_env() {
  {
    echo "POSTGRES_USER=dw"
    echo "POSTGRES_PASSWORD=${secret}"
    echo "POSTGRES_DB=dw"
    echo "RESTIC_REPOSITORY=${1:-$tmp/repo}"
    echo "RESTIC_PASSWORD_FILE=$tmp/etc/restic-password"
    echo "BACKUP_LOCAL_DIR=$tmp/local"
  } >"$tmp/.env"
  chmod 600 "$tmp/.env"
}

# run_install [args...]: install.sh con el .env de la prueba y sin nada del entorno de quien la
# corre. Deja la salida en $tmp/install.log y devuelve su código.
run_install() {
  env -u COMPOSE_PROJECT_NAME -u COMPOSE_FILE -u RESTIC_REPOSITORY -u RESTIC_PASSWORD_FILE \
    -u POSTGRES_USER -u POSTGRES_DB -u BACKUP_LOCAL_DIR -u BACKUP_HEALTHCHECK_URL \
    DENTALWARE_ENV_FILE="${ENV_OVERRIDE:-$tmp/.env}" bash "$install_sh" "$@" >"$tmp/install.log" 2>&1
}

no_secret() {
  if grep -qF "$secret" "$tmp/install.log"; then fail "install.sh $1 mostró un secreto"; fi
}

write_env
rc=0
run_install --dry-run || rc=$?
if [ "$rc" != "0" ]; then
  fail "install.sh --dry-run con la configuración completa debe salir con 0 (salió ${rc}): $(cat "$tmp/install.log")"
fi
for name in "${services[@]}"; do
  for kind in service timer; do
    grep -qF "/etc/systemd/system/${name}.${kind}" "$tmp/install.log" ||
      fail "install.sh --dry-run debe decir que copiaría ${name}.${kind} a /etc/systemd/system"
  done
  grep -qE "enable --now .*${name}\.timer" "$tmp/install.log" ||
    fail "install.sh --dry-run debe decir que activaría ${name}.timer"
done
grep -q 'daemon-reload' "$tmp/install.log" || fail "install.sh --dry-run debe decir que haría daemon-reload"
grep -qF "list-timers" "$tmp/install.log" || fail "install.sh --dry-run debe mostrar los timers al final"
grep -qF "restic snapshots" "$tmp/install.log" ||
  fail "con el repositorio ya creado, install.sh debe comprobar el acceso con restic snapshots"
grep -qF "${root}/infra" "$tmp/install.log" ||
  fail "install.sh --dry-run debe sustituir @DENTALWARE_DIR@ por la ruta del repo"
[ ! -e "$tmp/local" ] || fail "install.sh --dry-run no debe crear BACKUP_LOCAL_DIR"
no_secret "--dry-run"

# Sin --dry-run y sin ser root: se niega antes de tocar nada.
if [ "$(id -u)" != "0" ]; then
  rc=0
  run_install || rc=$?
  [ "$rc" != "0" ] || fail "install.sh sin --dry-run y sin root debe fallar"
  grep -q 'sudo' "$tmp/install.log" || fail "install.sh sin root debe pedir que se ejecute con sudo"
  [ ! -e "$tmp/local" ] || fail "install.sh sin root no debe crear nada"
fi

# Sin repositorio: pide --init; con --init, lo crearía.
write_env "$tmp/repo-nuevo"
rc=0
run_install --dry-run || rc=$?
[ "$rc" != "0" ] || fail "sin repositorio y sin --init, install.sh debe fallar"
grep -q -- '--init' "$tmp/install.log" || fail "sin repositorio, install.sh debe sugerir --init"
grep -q 'enable --now' "$tmp/install.log" &&
  fail "sin repositorio, install.sh no debe llegar a activar los timers"
rc=0
run_install --dry-run --init || rc=$?
[ "$rc" = "0" ] || fail "install.sh --dry-run --init debe salir con 0 (salió ${rc}): $(cat "$tmp/install.log")"
grep -qF "restic init" "$tmp/install.log" || fail "con --init y sin repositorio, install.sh debe hacer restic init"
no_secret "--dry-run --init"

# Falta una variable: la nombra, sin mostrar valores.
write_env
sed -i '/^RESTIC_PASSWORD_FILE=/d' "$tmp/.env"
rc=0
run_install --dry-run || rc=$?
[ "$rc" != "0" ] || fail "sin RESTIC_PASSWORD_FILE, install.sh debe fallar"
grep -q 'RESTIC_PASSWORD_FILE' "$tmp/install.log" || fail "install.sh debe nombrar la variable que falta"
no_secret "sin una variable"

# La contraseña de restic con permisos abiertos: la rechaza, sin mostrarla.
write_env
chmod 644 "$tmp/etc/restic-password"
rc=0
run_install --dry-run || rc=$?
[ "$rc" != "0" ] || fail "con la contraseña de restic en 644, install.sh debe fallar"
grep -q '600' "$tmp/install.log" || fail "install.sh debe pedir permisos 600 para la contraseña de restic"
no_secret "con la contraseña en 644"
chmod 600 "$tmp/etc/restic-password"

# Sin la contraseña de restic.
mv "$tmp/etc/restic-password" "$tmp/etc/otra"
rc=0
run_install --dry-run || rc=$?
[ "$rc" != "0" ] || fail "sin el archivo de la contraseña de restic, install.sh debe fallar"
grep -q 'RESTIC_PASSWORD_FILE' "$tmp/install.log" ||
  fail "sin la contraseña, install.sh debe nombrar RESTIC_PASSWORD_FILE"
mv "$tmp/etc/otra" "$tmp/etc/restic-password"

# Sin .env.
rc=0
ENV_OVERRIDE="$tmp/no-existe.env" run_install --dry-run || rc=$?
[ "$rc" != "0" ] || fail "sin .env, install.sh debe fallar"
grep -qF '.env' "$tmp/install.log" || fail "sin .env, install.sh debe decir que falta"

# Opción desconocida: error de uso (2).
rc=0
run_install --dry-run --nada || rc=$?
[ "$rc" = "2" ] || fail "una opción desconocida debe salir con 2 (salió ${rc})"

if [ "$failures" -gt 0 ]; then
  echo "${failures} comprobación(es) fallaron." >&2
  exit 1
fi
echo "Unidades de systemd e instalador: correctos."
