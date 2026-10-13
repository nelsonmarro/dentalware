# Recuperación de Dentalware

Qué hacer cuando se pierden datos: la base de datos (BD) se estropea o se borra algo, faltan fotos o se pierde el VPS entero. Los respaldos que se usan aquí están explicados en [`respaldos.md`](respaldos.md); el despliegue, en [`despliegue.md`](despliegue.md). Todos los comandos salen de los scripts de `infra/backup/`.

| Qué pasó | Caso | Se pierde, como mucho | Tiempo objetivo |
|---|---|---|---|
| La BD está corrupta, o se borró o cambió algo por error | [1](#caso-1--la-bd-a-una-fecha) | lo hecho desde el respaldo elegido (24 h con el último) | 4 h |
| Faltan fotos o adjuntos en el disco, pero la BD está bien | [2](#caso-2--archivos-borrados) | nada | 1 h |
| El VPS ya no existe o no arranca | [3](#caso-3--pérdida-total-del-vps) | hasta 7 días (riesgo aceptado, ver `respaldos.md`) | el día |

Antes de empezar:

- **Anota la hora.** Al terminar, apunta cuánto tardaste en el [registro](#registro-de-recuperaciones).
- **Nunca `dw down -v`** ni `docker volume prune`: borran la BD y las fotos.
- **No lances un respaldo a mano antes de restaurar.** restic guarda un solo snapshot por día, el último: un respaldo ahora borraría el de esta madrugada, que quizá es el que necesitas. `restore.sh` ya guarda una copia de la BD actual antes de sustituirla.
- Trabaja en `/opt/dentalware`, con los atajos `dw` (paso 6.3 de `despliegue.md`) y `dwrestic` (paso 12.5).
- Los scripts de restauración se ejecutan con `sudo`. Toman el mismo bloqueo que el respaldo, la verificación y el simulacro. Si uno está en curso, salen con código 75 sin tocar nada: «ya hay otro trabajo de respaldo en curso». Espera a que termine (`systemctl status dentalware-backup`) y repite.

## Qué hace `restore.sh`

`sudo infra/backup/restore.sh [--snapshot <id>|latest]` restaura **todo**. Sin `--snapshot`, usa el último.

1. Arranca Postgres si no estaba arrancado.
2. Saca del repositorio de restic el dump y las fotos del snapshot, a una carpeta temporal `restaurar.*` dentro de `/var/backups/dentalware`.
3. Guarda la BD actual en `/var/backups/dentalware/db/antes-de-restaurar-<fecha>.dump`, por si acaso.
4. Para la API.
5. Sustituye la BD por la del snapshot, en una sola transacción: si falla, la BD queda como estaba.
6. Copia las fotos al volumen de adjuntos y les pone el dueño de la API.
7. Arranca la API. La API aplica sola las migraciones que falten.

- Las fotos subidas después del snapshot se quedan en el disco, sin trabajo que las use. No molestan.
- La copia `antes-de-restaurar-*` se borra con los dumps locales, a los 3 días o poco más. Si la quieres guardar, muévela fuera de `db/`.

Otros dos modos, que no tocan la BD:

- `--solo-archivos <ruta>` devuelve solo los adjuntos que casan con `<ruta>` (caso 2).
- `--con-config <carpeta>` deja la configuración respaldada en una carpeta nueva, para revisarla (caso 3).

### Si hubo migraciones después del snapshot

`restore.sh` restaura **encima** de la BD actual. Borra y vuelve a crear lo que está en el dump, pero deja lo que no está en él. Así, si después del snapshot llegó una versión con una migración nueva, la tabla nueva sobrevive a la restauración, y la API, al arrancar, intenta crearla otra vez y no arranca. Para saber si es tu caso, busca migraciones posteriores a la fecha del snapshot:

```bash
cd /opt/dentalware
git log --oneline --since='<fecha del snapshot, AAAA-MM-DD>' -- apps/api/drizzle/
```

Si no sale nada, restaura normalmente. Si sale algo, restaura sobre una BD **vacía**, en este orden:

```bash
dw stop api                                      # 1. nadie escribe en la BD
dw exec -T postgres pg_dump -U dentalware -d dentalware -Fc |
  sudo sh -c 'umask 077; cat > /var/backups/dentalware/db/antes-de-borrar-$(date +%F-%H%M%S).dump'
sudo ls -l /var/backups/dentalware/db/           # 2. la copia de la BD actual, por si acaso
dw rm -sf postgres                               # 3. borra la BD actual
docker volume rm dentalware_pgdata
sudo infra/backup/restore.sh --snapshot <id>     # 4. Postgres vacío + el snapshot; la API arranca
dw up -d                                         # 5. el resto de servicios
```

La copia del paso 2 se hace con `pg_dump` y no con un respaldo, para no borrar el snapshot del día (ver «Antes de empezar»). Se deshace como la copia `antes-de-restaurar-*` ([abajo](#caso-1--la-bd-a-una-fecha)). En el paso 4, la API arranca con el código actual y migra la BD restaurada, que tiene el esquema del snapshot. No vuelvas atrás el código: el esquema viejo lo sube la propia API.

## Caso 1 — La BD a una fecha

Para una BD corrupta o un error humano: un trabajo, un pago o una clínica borrados o cambiados por error.

1. Avisa al equipo de que no trabaje en Dentalware hasta que termines: lo que hagan se perderá.
2. Elige el snapshot. Las horas salen en UTC (en Ecuador, 5 horas menos):

   ```bash
   cd /opt/dentalware
   dwrestic snapshots
   ```

   Cada respaldo diario sale con su ID, su fecha, el host `dentalware` y la etiqueta `diario`. Queda uno por día, el último de ese día: 7 diarios, y después uno por semana y uno por mes. Elige el último **anterior** al problema. Por ejemplo, si el borrado fue hoy a las 11:00, el de esta madrugada.
3. Comprueba que no hubo [migraciones después del snapshot](#si-hubo-migraciones-después-del-snapshot). Si las hubo, sigue ese orden en vez del paso 4.
4. Restaura:

   ```bash
   sudo infra/backup/restore.sh --snapshot <id>
   # … «Restauración completa desde el snapshot <id>.»
   dw ps                                            # api y postgres (healthy)
   ```

5. Pasa la [lista de verificación](#lista-de-verificación-final). Después, avisa al equipo de qué se perdió: todo lo registrado desde la hora del snapshot.

**Deshacer.** Para volver a la BD de antes de restaurar, sustitúyela por la copia `antes-de-restaurar-*` (o `antes-de-borrar-*`), con el mismo comando que usa `restore.sh`:

```bash
sudo ls -lt /var/backups/dentalware/db/
dw stop api
sudo cat /var/backups/dentalware/db/antes-de-restaurar-<fecha>.dump |
  dw exec -T postgres pg_restore --clean --if-exists --no-owner --single-transaction \
    --exit-on-error -U dentalware -d dentalware
dw up -d
```

## Caso 2 — Archivos borrados

Para cuando la ficha de un trabajo muestra una foto rota y la BD está bien. Si la foto se borró desde la app, ya no está en la BD: es el caso 1.

1. Busca la ruta de los adjuntos del trabajo (`<caseId>/<id>.<ext>` y su miniatura `<caseId>/<id>.thumb.webp`):

   ```bash
   dw exec postgres psql -U dentalware -d dentalware -c \
     "select a.storage_path, a.thumb_path, a.filename from attachments a join cases c on c.id = a.case_id where c.code = '26-00101'"
   ```

2. Devuélvelos desde el último respaldo. La ruta admite comodines:

   ```bash
   sudo infra/backup/restore.sh --solo-archivos '<caseId>/<id>.*'    # el adjunto y su miniatura
   sudo infra/backup/restore.sh --solo-archivos '<caseId>/*'         # todos los del trabajo
   # … «Restaurados N archivo(s) en dentalware_uploads. La base de datos no se tocó.»
   ```

   Si la foto se perdió hace días, elige un snapshot anterior con `dwrestic snapshots` y añade `--snapshot <id>`.
3. Abre la ficha del trabajo: la foto se ve y abre.

Si `restore.sh` dice «ningún adjunto del snapshot … casa con …», ese snapshot no tiene el archivo: puede que se subiera después de él, o que la ruta esté mal escrita.

## Caso 3 — Pérdida total del VPS

El VPS no existe o no arranca. Queda lo que está fuera de él:

- **la copia manual del repositorio de restic en tu PC**, si la hiciste (`respaldos.md`, «Copia en tu PC»); y
- **los backups semanales de Hostinger**, el disco entero del VPS, guardados en otro nodo.

Usa la más reciente de las dos. La copia del PC tiene la fecha de su último `rsync`, y el backup de Hostinger, la que da hPanel. Necesitas además, de tu gestor de contraseñas, **la contraseña de restic** y, por si acaso, el `infra/.env`.

### Ruta A: backup semanal de Hostinger

Restaura el disco entero del VPS a la fecha de ese backup: Docker, el repo, el `.env`, los respaldos de restic y los timers.

1. En hPanel › VPS › Administrar › Backups & Monitoring › Snapshots & Backups, elige la copia y pulsa «Restore». El VPS queda bloqueado mientras dura, de 10 minutos a unas horas, y no se puede cancelar. Si el VPS ya no existe, pide a soporte de Hostinger que restaure esa copia en el VPS nuevo.
2. Entra por SSH y comprueba que todo arrancó: `dw ps` (los tres sanos), `systemctl list-timers 'dentalware-*'` y `https://dentalware.naphsoft.dev`.
3. Si la copia del PC es **más nueva** que el backup de Hostinger, pon encima su último snapshot: aparta el repositorio viejo con `sudo mv /var/backups/dentalware/restic /var/backups/dentalware/restic.hostinger`, sigue los pasos 5, 10 y 11 de la ruta B y borra el repositorio apartado cuando hayas pasado la [lista de verificación](#lista-de-verificación-final).
4. Pasa la lista de verificación.

### Ruta B: VPS nuevo con la copia del PC

1. **VPS nuevo.** Créalo en hPanel (o reinstala el sistema del que no arranca) y anota la IP. Entra como `nelson`, con `sudo`.
2. **DNS ya.** En Porkbun, cambia el registro A de `dentalware` (y el AAAA, si lo tenías) a la IP nueva (paso 1 de `despliegue.md`). Hazlo ahora: la propagación tarda, y el certificado del paso 12 la necesita.
3. **Sistema.** Firewall (paso 2) y Docker (paso 3). nginx con certbot, como en el VPS de antes: allí ya estaban por naphsoft, y su configuración no está en este respaldo.
4. **Repo.** Clónalo en `/opt/dentalware` (paso 4).
5. **Repositorio de restic.** Súbelo desde tu PC a tu carpeta del VPS y, ya en él, muévelo a su sitio, solo para root:

   ```bash
   # En tu PC:
   rsync -a ~/respaldos-dentalware/restic/ nelson@<IP nueva>:copia-restic/
   # En el VPS:
   sudo install -d -m 700 /var/backups/dentalware
   sudo rsync -a --delete ~/copia-restic/ /var/backups/dentalware/restic/
   sudo chown -R root:root /var/backups/dentalware/restic
   rm -rf ~/copia-restic
   ```

6. **Contraseña de restic.** Cópiala de tu gestor de contraseñas. Pégala, pulsa Intro y después Ctrl+D:

   ```bash
   sudo install -d -m 700 /etc/dentalware
   sudo sh -c 'umask 077; cat > /etc/dentalware/restic-password'
   ```

7. **Configuración respaldada.** Sácala del último snapshot a una carpeta nueva. Usa una ruta absoluta: una relativa acabaría dentro de `infra/`. Sin `.env`, el script lee el repositorio y la contraseña del entorno:

   ```bash
   sudo env RESTIC_REPOSITORY=/var/backups/dentalware/restic \
     RESTIC_PASSWORD_FILE=/etc/dentalware/restic-password \
     /opt/dentalware/infra/backup/restore.sh --con-config /root/config-recuperada
   # … «Configuración en /root/config-recuperada: …» con .env, Caddyfile.vps, docker-compose.vps.yml y nginx-dentalware
   ```

   Si dice «no se puede leer RESTIC_PASSWORD_FILE» o restic no abre el repositorio, la contraseña no es la de este repositorio: revisa el paso 6.
8. **Revisa y coloca la configuración.** Compara el `.env` con el de tu gestor. Si el VPS estuvo comprometido, cambia antes los secretos ([abajo](#si-el-vps-estuvo-comprometido)).

   ```bash
   sudo cat /root/config-recuperada/.env
   cd /opt/dentalware
   sudo install -m 600 -o nelson -g nelson /root/config-recuperada/.env infra/.env
   sudo install -m 644 -o nelson -g nelson /root/config-recuperada/Caddyfile.vps infra/Caddyfile.vps
   sudo install -m 644 -o nelson -g nelson /root/config-recuperada/docker-compose.vps.yml infra/docker-compose.vps.yml
   ```

   `nginx-dentalware` es el sitio de nginx tal como lo dejó certbot, con rutas a certificados que el VPS nuevo aún no tiene. No lo copies: te sirve de referencia para el paso 12.
9. **Atajos.** Añade `dw` (paso 6.3) y `dwrestic` (paso 12.5) al `~/.bashrc`, y comprueba que el repositorio se lee:

   ```bash
   dw config --quiet && echo "configuración válida"
   dwrestic snapshots
   ```

10. **Construye sin arrancar.** Así la API no crea un esquema vacío antes de restaurar ([por qué](#si-hubo-migraciones-después-del-snapshot)):

    ```bash
    dw create --build
    ```

11. **Restaura** la BD y las fotos. Usa `latest`, el último, o `--snapshot <id>`. Después, arranca el resto:

    ```bash
    sudo infra/backup/restore.sh
    # … «Restauración completa desde el snapshot latest.»
    dw up -d
    dw ps                                         # los tres sanos
    curl -s http://127.0.0.1:8080/api/health      # OK
    ```

12. **nginx y certificado.** Cuando `dig +short dentalware.naphsoft.dev` dé la IP nueva, repite el paso 8 de `despliegue.md`: el sitio, certbot y la renovación.
13. **Respaldos.** Vuelve a programarlos. Sin `--init`, porque el repositorio ya existe. Y lanza uno ahora:

    ```bash
    sudo infra/backup/install.sh --dry-run
    sudo infra/backup/install.sh
    sudo systemctl start dentalware-backup.service
    journalctl -u dentalware-backup -n 5           # «Respaldo correcto: snapshot …»
    ```

14. **Comprueba** con la [lista de verificación](#lista-de-verificación-final) y borra la configuración sacada: `sudo rm -rf /root/config-recuperada`.
15. **Anota** en el [registro](#registro-de-recuperaciones) la hora de fin, el snapshot y qué falló.

## Lista de verificación final

Al terminar cualquiera de los tres casos:

- [ ] `https://dentalware.naphsoft.dev` abre con candado válido y entras como admin.
- [ ] **Trabajos:** la lista tiene los de la fecha del snapshot, y los últimos que recuerdas están.
- [ ] **Clínicas:** están todas, con sus doctores y precios.
- [ ] **Fotos:** abre la ficha de dos o tres trabajos con fotos: las miniaturas se ven y la foto abre.
- [ ] **Cuentas:** el saldo de una clínica que conozcas cuadra.
- [ ] **Login:** recepción, un técnico y el mensajero entran con sus contraseñas.
- [ ] **El respaldo siguiente en verde:** `sudo systemctl start dentalware-backup.service` y `journalctl -u dentalware-backup -n 5` dice «Respaldo correcto». Sustituye al snapshot de hoy: lánzalo solo cuando la lista de arriba esté bien. Si quieres más seguridad, lanza también el simulacro: `sudo systemctl start dentalware-restore-drill.service` → «Simulacro correcto».
- [ ] El equipo sabe qué se perdió (lo hecho después del snapshot) y lo vuelve a registrar.

## Si una restauración se interrumpe

Por un corte de luz, un `kill` o porque se cerró la sesión SSH. Se ve en que el log no termina en «Restauración completa».

- **La BD** queda entera: o como estaba, o ya restaurada. `pg_restore` va en una sola transacción.
- **La API** puede haberse quedado parada: `dw ps` y, si hace falta, `dw up -d`.
- **Lo que queda en el disco:** la carpeta temporal `restaurar.*`, con el dump y las fotos **sin cifrar**. Si el script termina, la borra él; si lo cortan, no. Bórrala a mano:

  ```bash
  sudo find /var/backups/dentalware /tmp -maxdepth 1 -name 'restaurar.*'
  sudo rm -rf /var/backups/dentalware/restaurar.<xxxxxx>
  ```

  En `/tmp` solo quedan las de `--con-config` sin `.env` (caso 3, paso 7).
- **Repite** la restauración: es segura de repetir.

Para no depender de la sesión SSH en una restauración larga, ábrela dentro de `tmux` o `screen` si están instalados.

## Si el VPS estuvo comprometido

Si alguien entró en el VPS, el repositorio de restic local, los scripts, el `.env` y los timers pueden estar manipulados. Un snapshot reciente también: el intruso pudo respaldar datos alterados.

1. **No restaures desde el repositorio del VPS.** Hazlo desde la copia de tu PC hecha antes del incidente, o desde un backup de Hostinger anterior (ruta A o B del caso 3). Usa un VPS reinstalado, no el comprometido.
2. **Rota todos los secretos** antes de arrancar:
   - `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET` y `ADMIN_PASSWORD` en el `infra/.env`, con `openssl rand` como en el paso 5 de `despliegue.md`. En el VPS nuevo, la BD se crea con la contraseña nueva, y al cambiar `BETTER_AUTH_SECRET` se cierran todas las sesiones.
   - Las contraseñas de cada usuario: Configuración › Usuarios › editar › «Nueva contraseña».
   - La contraseña de restic. Crea un repositorio **nuevo** en el VPS nuevo, con otra contraseña y `sudo infra/backup/install.sh --init`, y guarda la copia del PC con la que restauraste aparte, sin mezclarla.
   - Las claves SSH que tuviera el VPS, la contraseña de `sudo` de `nelson` y el token de la API de Hostinger.
3. **Revisa** el `.env` y la configuración recuperada línea a línea antes de usarlos.
4. **Avisa:** hay datos de pacientes (LOPDP).

## Registro de recuperaciones

Apunta cada recuperación y cada ensayo: cuánto se tardó de verdad y qué falló en esta guía.

| Fecha | Caso | Snapshot | Tiempo | Notas |
|---|---|---|---|---|
