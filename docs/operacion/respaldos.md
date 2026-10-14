# Respaldos de Dentalware

Qué se respalda, cuándo, dónde y cómo saber que funciona. Se instalan con el paso 12 de [`despliegue.md`](despliegue.md). Para recuperar datos, sigue [`recuperacion.md`](recuperacion.md). Los scripts están en `infra/backup/` y su prueba de punta a punta, en `infra/tests/backup-roundtrip.sh`, que corre en cada PR (job `respaldo` de CI).

## Resumen

| Trabajo | Cuándo (hora de Ecuador) | Qué hace | Script |
|---|---|---|---|
| Respaldo | todos los días a las 03:00, con hasta 10 min al azar | dump de Postgres, fotos y configuración al repositorio de restic, y aplica la retención | `backup.sh` |
| Verificación | los domingos a las 05:00 | `restic check --read-data-subset=5%`: la estructura del repositorio y un 5 % de los datos, leídos y descifrados | `check.sh` |
| Simulacro | el día 1 de cada mes a las 05:30 | restaura el último respaldo aparte y lo compara con producción, sin tocarla | `drill.sh` |

Cada trabajo es un servicio de systemd con su timer: `dentalware-backup`, `dentalware-backup-check` y `dentalware-restore-drill`. Corren como root, con prioridad baja de CPU y disco, y su salida queda en journald. Nunca corren dos a la vez: comparten un bloqueo, y el que llega segundo sale con código 75 sin hacer nada.

Objetivos, con el servidor vivo (un error humano, una BD corrupta o archivos borrados): perder como mucho **24 h** (RPO) y recuperarse en **4 h** (RTO).

## Qué se respalda y dónde

Cada respaldo diario es un snapshot de restic, con el host `dentalware` y la etiqueta `diario`, que lleva:

- **La base de datos:** un `pg_dump -Fc` completo, que se valida antes de guardarlo. Ese dump se queda además 3 días en `/var/backups/dentalware/db/`, sin cifrar y solo para root, para restaurar rápido sin pasar por restic.
- **Las fotos y adjuntos:** el volumen `dentalware_uploads`, entero.
- **La configuración de este servidor**, si existe: `infra/.env`, `infra/Caddyfile.vps`, `infra/docker-compose.vps.yml` y `/etc/nginx/sites-available/dentalware`. El resto ya está en git.

Todo va a un **repositorio de restic local**, `/var/backups/dentalware/restic`, cifrado con la contraseña de restic. restic deduplica: una foto que no cambia no vuelve a ocupar espacio. restic corre en un contenedor (`restic/restic`, con la versión fijada en `infra/backup/restic.env`), así que el VPS no instala nada salvo Docker.

| Ruta en el VPS | Qué es | Permisos |
|---|---|---|
| `/var/backups/dentalware/restic` | el repositorio de restic (cifrado) | root, 700 |
| `/var/backups/dentalware/db` | los dumps de los últimos 3 días y las copias `antes-de-restaurar-*` (sin cifrar) | root, 700 |
| `/var/backups/dentalware/.lock` | el bloqueo compartido | root |
| `/etc/dentalware/restic-password` | la contraseña de restic | root, 600 |

## Retención

- **Snapshots:** se conserva **todo lo de los últimos 3 días**, contados desde el snapshot más reciente. Un respaldo lanzado a mano nunca borra los de los 3 días anteriores a él (así, nunca el de las 03:00 del mismo día), pero sí adelanta ese corte, igual que el respaldo de la noche siguiente: un snapshot de hace algo más de 3 días que no fue el último de su día desaparece con él. Por eso, antes de restaurar se anota el id del snapshot y la BD actual se guarda con `pg_dump`, no con un respaldo (`recuperacion.md`, caso 1). Lo anterior pasa a la regla 7/4/12: el último de cada uno de los 7 días más recientes con respaldos, de cada una de las 4 últimas semanas y de cada uno de los 12 últimos meses. restic conserva un snapshot si lo pide cualquiera de las reglas, y mientras no haya 7 días de respaldos, también el más antiguo. Lo aplica `backup.sh` al terminar cada respaldo (`restic forget --keep-within 3d --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune`, valores en `infra/backup/restic.env`).
- **Dumps locales:** los de más de 3 días en `db/` se borran en el respaldo siguiente. Eso incluye las copias `antes-de-restaurar-*` que deja una restauración: si quieres guardar una, muévela fuera de `db/`.

## Avisos

Por omisión, **nadie recibe avisos**: no se usa ninguna plataforma externa. El resultado de cada trabajo queda en journald, y uno que falla sale como `failed` en systemd. Revisa el estado una vez por semana ([abajo](#cómo-ver-el-estado)).

Si algún día quieres avisos, pon en `infra/.env` la URL de un check de healthchecks.io (u otro servicio compatible) en `BACKUP_HEALTHCHECK_URL` (respaldo), `BACKUP_CHECK_HEALTHCHECK_URL` (verificación) o `BACKUP_DRILL_HEALTHCHECK_URL` (simulacro). Cada trabajo avisa entonces el inicio, el éxito y el fallo, con las últimas líneas del log. Vacías, el log dice «… vacía: sin avisos». No hace falta reinstalar nada: los scripts leen el `.env` cada vez.

## Cómo ver el estado

Cuándo corrió cada trabajo por última vez y cuándo le toca otra vez (columnas `LAST` y `NEXT`):

```bash
systemctl list-timers --all 'dentalware-*'
systemctl list-units --failed 'dentalware-*'   # «0 loaded units listed.» si nada falló
```

El último resultado de cada uno. `Result=success` y `ExecMainStatus=0` es que fue bien; con `ExecMainExitTimestamp` vacío, es que aún no ha corrido nunca:

```bash
systemctl show -p Result,ExecMainStatus,ExecMainExitTimestamp dentalware-backup.service
systemctl show -p Result,ExecMainStatus,ExecMainExitTimestamp dentalware-backup-check.service
systemctl show -p Result,ExecMainStatus,ExecMainExitTimestamp dentalware-restore-drill.service
```

Y su log. Cada trabajo termina con una línea que lo dice:

```bash
journalctl -u dentalware-backup -n 20               # «Respaldo correcto: snapshot 1a2b3c4d, … añadidos.»
journalctl -u dentalware-backup-check -n 20         # «Verificación correcta: el repositorio no tiene errores.»
journalctl -u dentalware-restore-drill -n 40        # «Simulacro correcto: snapshot …: N trabajos, N clínicas, N adjuntos; …»
journalctl -u dentalware-backup --since '7 days ago' | grep -E 'correcto|ERROR'
```

Si `journalctl` no muestra nada y avisa de que no tienes permiso para leer el diario del sistema, antepón `sudo`.

| Lo que ves | Qué significa | Qué hacer |
|---|---|---|
| `ExecMainStatus=75` y «ya hay otro trabajo de respaldo en curso» | se omitió porque otro trabajo ocupaba el bloqueo | nada, si es raro; si no, lánzalo a mano |
| `ERROR: …` con `Result=exit-code` | falló; las líneas de antes dicen por qué | corrige la causa y lánzalo a mano |
| «el respaldo no tiene filas en cases» (o en `clinics` o `attachments`) en el simulacro | a la BD respaldada le faltan trabajos, clínicas o adjuntos (por ejemplo, recién instalada) | crea una clínica y un trabajo de prueba con una foto, respalda y repite |

Para lanzar un trabajo a mano, con el mismo entorno que el timer, y ver cómo va:

```bash
sudo systemctl start dentalware-backup.service             # o -backup-check, -restore-drill
journalctl -u dentalware-backup -f                          # Ctrl+C para salir
```

Los snapshots del repositorio, con el atajo `dwrestic` (paso 12.5 de `despliegue.md`). Las horas salen en UTC (en Ecuador, 5 horas menos):

```bash
dwrestic snapshots
dwrestic ls latest | head                                   # qué hay en el último
```

## Después de un apagado

Los timers tienen `Persistent=true`: si el VPS estaba apagado a la hora de un trabajo, el trabajo corre en cuanto vuelve a arrancar. Puede pasar entonces que corra antes de que Postgres esté listo. Docker ya arrancó, pero los contenedores aún no están sanos. Si es así, el trabajo falla («service "postgres" is not running», o un error de `pg_dump` o `psql`) y queda `failed`, igual que cualquier fallo. Puede pasar también que choquen dos trabajos atrasados: el segundo sale con 75.

Qué hacer tras un apagado o un reinicio:

1. `dw ps` hasta ver los tres contenedores sanos.
2. `systemctl list-units --failed 'dentalware-*'`.
3. Lanza a mano el que haya fallado: `sudo systemctl start dentalware-backup.service`. Si fue el simulacro, lánzalo también: si no, no vuelve a correr hasta el mes siguiente.

## Espacio en disco

- **El repositorio** crece con las fotos nuevas y con un dump comprimido por día, menos lo que borra la retención.
- **El simulacro**, mientras corre, necesita además:
  - una restauración completa en `/var/backups/dentalware/simulacro.*`: todas las fotos más el dump;
  - el Postgres temporal con la BD cargada, en un volumen de Docker, en el mismo disco. Ocupa varias veces el dump, porque el dump va comprimido.
- **Una restauración** (`restore.sh`) necesita lo mismo en `restaurar.*`.

Para estimarlo:

```bash
df -h /var/backups /var/lib/docker
sudo du -sh /var/backups/dentalware/restic /var/backups/dentalware/db
docker system df -v | grep dentalware_uploads
dw exec postgres psql -U dentalware -d dentalware -c "select pg_size_pretty(pg_database_size('dentalware'))"
```

Regla práctica: deja libre al menos el tamaño de las fotos más tres veces el de la BD. Si el disco se queda corto, el simulacro falla y lo dice. Su barrido borra después los restos.

## Dónde están los secretos

- **En tu gestor de contraseñas:** el `infra/.env` completo y la **contraseña de restic**. Sin ella, el repositorio no se puede leer: ni el del VPS, ni la copia de tu PC, ni el que va dentro del backup de Hostinger.
- **En el VPS:** `infra/.env` (600) y `/etc/dentalware/restic-password` (600, root).
- **En el repositorio de git:** ninguno. Los scripts nunca muestran un secreto en el log.

## Quién puede tocar los respaldos

Los servicios corren como root y ejecutan los scripts del repo clonado en `/opt/dentalware`, que es de `nelson`. Cualquiera que pueda escribir en `/opt/dentalware` puede, por tanto, hacerse root: basta con cambiar `backup.sh` y esperar a las 03:00. Por eso:

- `/opt/dentalware` es de un usuario de confianza (`nelson`) y nadie más puede escribir en él. Compruébalo tras cada cambio de permisos; `find` no debe sacar nada:

  ```bash
  ls -ld /opt/dentalware
  find /opt/dentalware -perm -o+w ! -type l
  ```

- Ningún otro servicio del VPS (naphsoft incluido) corre como `nelson`.
- Antes de `git pull`, `git status` limpio: nada cambiado a mano en `infra/backup/`.
- El grupo `docker` ya equivale a root (paso 3): `nelson` es de confianza igual.

## No corras las pruebas en el VPS

Al empezar, el simulacro borra todos los contenedores, redes y volúmenes `dw-drill-*` del Docker del host, porque da por hecho que son restos de uno interrumpido. Las pruebas de `infra/tests/` usan esos mismos nombres, y además levantan proyectos y repositorios propios. **Córrelas solo en tu PC o en CI, nunca en el VPS.**

## Riesgo aceptado: la pérdida total del VPS

Todo lo anterior vive en el mismo VPS: sirve ante errores, BD corrupta o archivos borrados, pero no si se pierde el VPS entero. Decisión de Nelson (2026-10-10): para el MVP **no se usa ninguna plataforma de respaldos externa**. Lo que queda fuera del VPS es:

1. **Los backups semanales de Hostinger:** el disco entero del VPS, en otro nodo y sin coste extra. Según la ayuda de Hostinger, se guardan los dos últimos semanales. Ante la pérdida total, **se pueden perder hasta 7 días** de trabajo. Es el riesgo aceptado.
2. **La copia manual en tu PC** del repositorio de restic, opcional. Acorta esa pérdida a la fecha de la última copia.

Cómo restaurar un backup de Hostinger: hPanel › VPS › Administrar › Backups & Monitoring › Snapshots & Backups › «Restore» junto a la fecha. Sobrescribe el disco entero del VPS con el de esa fecha y no se puede cancelar. El paso a paso está en `recuperacion.md`, caso 3, ruta A.

El driver S3 (#48) y un destino de respaldos externo quedan para después del MVP.

### Copia en tu PC

El repositorio es solo de root, así que se copia en dos pasos: en el VPS, `sudo` lo copia a una carpeta tuya; desde el PC, `rsync` la trae. La copia **sigue cifrada** con la contraseña de restic. Hazlo una vez por semana, o antes de un cambio grande. La copia en el VPS toma el bloqueo de los respaldos (`flock` sobre `/var/backups/dentalware/.lock`): si a esa hora corre un respaldo, una verificación o un simulacro, espera a que termine, para no copiar el repositorio a medio escribir.

```bash
# Desde tu PC. El primero pide la contraseña de sudo del VPS:
ssh -t nelson@82.25.95.39 'sudo flock /var/backups/dentalware/.lock rsync -a --delete /var/backups/dentalware/restic/ ~/copia-restic/ && sudo chown -R nelson: ~/copia-restic'
mkdir -p ~/respaldos-dentalware
rsync -a --delete nelson@82.25.95.39:copia-restic/ ~/respaldos-dentalware/restic/
```

- `~/copia-restic` se queda en el VPS para que la próxima copia solo mueva lo nuevo. Ocupa lo mismo que el repositorio: si falta disco, bórrala después con `ssh nelson@82.25.95.39 rm -rf copia-restic`.
- Si en el VPS falta `rsync`: `sudo pacman -Syu rsync`.
- Para restaurar desde esta copia, sigue `recuperacion.md`, caso 3, ruta B.
