# Recuperación de Dentalware

Qué hacer cuando se pierden datos: la base de datos (BD) se estropea o se borra algo, faltan fotos o se pierde el VPS entero. Los respaldos que se usan aquí están explicados en [`respaldos.md`](respaldos.md); el despliegue, en [`despliegue.md`](despliegue.md). Todos los comandos salen de los scripts de `infra/backup/`.

| Qué pasó | Caso | Se pierde, como mucho | Tiempo objetivo |
|---|---|---|---|
| La BD está corrupta, o se borró o cambió algo por error | [1](#caso-1--la-bd-a-una-fecha) | lo hecho desde el respaldo elegido (24 h con el último) | 4 h |
| Faltan fotos o adjuntos en el disco, pero la BD está bien | [2](#caso-2--archivos-borrados) | las fotos subidas después del último respaldo (24 h) | 1 h |
| El VPS ya no existe o no arranca | [3](#caso-3--pérdida-total-del-vps) | hasta 7 días (riesgo aceptado, ver `respaldos.md`) | el día |

Antes de empezar:

- **Anota la hora.** Al terminar, apunta cuánto tardaste en el [registro](#registro-de-recuperaciones).
- **Nunca `dw down -v`** ni `docker volume prune`: borran la BD y las fotos.
- **No corras las pruebas de `infra/tests/` en el VPS**: el simulacro borra al empezar todo contenedor, red y volumen `dw-drill-*` del Docker del host, y las pruebas usan esos nombres (`respaldos.md`).
- Trabaja en `/opt/dentalware`, con los atajos `dw` (paso 6.3 de `despliegue.md`) y `dwrestic` (paso 12.5).
- Los scripts de restauración se ejecutan con `sudo`. Toman el mismo bloqueo que el respaldo, la verificación y el simulacro. Si uno está en curso, salen con código 75 sin tocar nada: «ya hay otro trabajo de respaldo en curso». Espera a que termine (`systemctl status dentalware-backup`) y repite.

## Qué hace `restore.sh`

`sudo infra/backup/restore.sh [--snapshot <id>|latest]` restaura **todo**. Sin `--snapshot`, usa el último.

1. Arranca Postgres si no estaba arrancado.
2. Saca del repositorio de restic el dump y las fotos del snapshot, a una carpeta temporal `restaurar.*` dentro de `/var/backups/dentalware`.
3. Guarda la BD actual en `/var/backups/dentalware/db/antes-de-restaurar-<fecha>.dump`, por si acaso.
4. Para la API. Si la restauración falla a partir de aquí, la vuelve a arrancar solo si estaba en marcha al empezar: en el caso 1, en la ruta B y al volver atrás estaba parada, y sigue parada.
5. Sustituye la BD por la del snapshot, en una sola transacción: si falla, la BD queda como estaba.
6. Copia las fotos al volumen de adjuntos y les pone el dueño de la API.
7. Arranca la API. La API aplica sola las migraciones que falten.

- Las fotos subidas después del snapshot se quedan en el disco, sin trabajo que las use. No molestan.
- La copia `antes-de-restaurar-*` se borra con los dumps locales, a los 3 días o poco más. Si la quieres guardar, muévela fuera de `db/`.
- En el caso 1 y al volver atrás una versión, se usa siempre sobre una BD vacía ([por qué](#por-qué-se-restaura-sobre-una-bd-vacía)).

Otros dos modos, que no tocan la BD:

- `--solo-archivos <ruta>` devuelve solo los adjuntos que casan con `<ruta>` (caso 2).
- `--con-config <carpeta>` deja la configuración respaldada en una carpeta nueva, para revisarla (caso 3).

### Por qué se restaura sobre una BD vacía

`restore.sh` restaura **encima** de la BD que encuentra: borra y vuelve a crear lo que está en el dump, pero deja lo que no está en él. Si entre el snapshot y hoy se desplegó una versión con una migración nueva, su tabla sobrevive a la restauración. La API, al arrancar, intenta crearla otra vez y no arranca: `restore.sh` falla esperando a que la API esté sana, y `dw logs api` dice `already exists`. Saber de antemano si hubo una migración no es fiable, porque cuenta cuándo se desplegó y no cuándo se commiteó. Por eso, el caso 1 **siempre** borra antes la BD: sobre una BD vacía, la API arranca con el código actual y sube ella misma el esquema del snapshot.

## Caso 1 — La BD a una fecha

Para una BD corrupta o un error humano: un trabajo, un pago o una clínica borrados o cambiados por error. Así se restauran solo los datos; para volver además a una versión anterior del programa, sigue «Volver atrás» en [`despliegue.md`](despliegue.md), que usa estos mismos pasos.

1. Avisa al equipo de que no trabaje en Dentalware hasta que termines: lo que hagan se perderá.
2. Elige el snapshot y **anota su id**. Las horas salen en UTC (en Ecuador, 5 horas menos):

   ```bash
   cd /opt/dentalware
   dwrestic snapshots
   ```

   Cada respaldo sale con su ID, su fecha, el host `dentalware` y la etiqueta `diario`. De los últimos 3 días están todos, también los lanzados a mano; de antes, el último de cada día durante 7 días con respaldos, y después uno por semana y uno por mes. Elige el último **anterior** al problema. Por ejemplo, si el borrado fue hoy a las 11:00, el de esta madrugada.
3. Para la API y guarda la BD actual, para poder deshacer. Es un `pg_dump` y no un respaldo: un respaldo aplica la retención, y podría borrar un snapshot de hace 3 días que no fuera el último de su día, quizá el que vas a restaurar.

   ```bash
   dw stop api
   dw exec -T postgres pg_dump -U dentalware -d dentalware -Fc |
     sudo sh -c 'umask 077; cat > /var/backups/dentalware/db/antes-de-borrar-$(date +%F-%H%M%S).dump'
   sudo ls -l /var/backups/dentalware/db/          # la copia, con su tamaño
   sudo cat /var/backups/dentalware/db/antes-de-borrar-<fecha>.dump |
     dw exec -T postgres pg_restore -l >/dev/null && echo "copia válida"
   ```

   **Si `pg_dump` dio un error, la copia pesa 0 o no sale «copia válida», no sigas:** el paso 4 borra la BD y no tiene vuelta. Con la BD corrupta puede que `pg_dump` no llegue a terminar; en ese caso, la única copia es el snapshot, y antes de borrar nada conviene apartar el volumen entero, si hay espacio en disco: `dw stop postgres` y `sudo cp -a /var/lib/docker/volumes/dentalware_pgdata /var/backups/dentalware/pgdata-antes-de-borrar`.

4. Borra la BD y restaura el snapshot sobre una vacía. `restore.sh` levanta un Postgres nuevo, carga el dump, copia las fotos y arranca la API, que migra lo que haga falta:

   ```bash
   dw rm -sf postgres
   docker volume rm dentalware_pgdata
   sudo infra/backup/restore.sh --snapshot <id>
   # … «Restauración completa desde el snapshot <id>.»
   dw up -d
   dw ps                                            # los tres (healthy)
   ```

   Aquí la copia `antes-de-restaurar-*` que deja `restore.sh` es la de la BD vacía: la buena es la `antes-de-borrar-*` del paso 3.

   **Si `restore.sh` falla o se corta**, la API sigue parada: no hagas `dw up -d`. Sobre la BD vacía, la API crearía el esquema actual, y la restauración siguiente fallaría con `already exists`. Corrige lo que diga el log y repite este paso entero, desde `dw rm -sf postgres`. No repitas el paso 3: la copia buena sigue siendo la `antes-de-borrar-*`.
5. Pasa la [lista de verificación](#lista-de-verificación-final). Después, avisa al equipo de qué se perdió: todo lo registrado desde la hora del snapshot.

**Deshacer.** Para volver a la BD de antes de restaurar, sustitúyela por la copia `antes-de-borrar-*`, con el mismo comando que usa `restore.sh`:

```bash
sudo ls -lt /var/backups/dentalware/db/
dw stop api
sudo cat /var/backups/dentalware/db/antes-de-borrar-<fecha>.dump |
  dw exec -T postgres pg_restore --clean --if-exists --no-owner --single-transaction \
    --exit-on-error -U dentalware -d dentalware
dw up -d
```

Las copias de `db/` se borran a los 3 días o poco más: si quieres guardar una, muévela fuera de `db/`.

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
3. Si la copia del PC es **más nueva** que el backup de Hostinger, pon encima su último snapshot. La pila ya está arrancada, así que no se usa `dw create`:
   1. Pon el código al día, porque la BD de la copia del PC puede ser de una versión posterior a la del disco de Hostinger: `cd /opt/dentalware && git pull && dw up -d --build`, y después `sudo infra/backup/install.sh`.
   2. Aparta el repositorio viejo con `sudo mv /var/backups/dentalware/restic /var/backups/dentalware/restic.hostinger` y trae el del PC con el paso 5 de la ruta B.
   3. Restaura su último snapshot con los pasos 2 a 4 del [caso 1](#caso-1--la-bd-a-una-fecha), sobre una BD vacía.
   4. Cuando hayas pasado la [lista de verificación](#lista-de-verificación-final), borra el repositorio apartado: `sudo rm -rf /var/backups/dentalware/restic.hostinger`.
4. Pasa la lista de verificación.

### Ruta B: VPS nuevo con la copia del PC

1. **VPS nuevo.** Créalo en hPanel (o reinstala el sistema del que no arranca) y anota la IP. Entra como `nelson`, con `sudo`.
2. **DNS ya.** En Porkbun, cambia el registro A de `dentalware` (y el AAAA, si lo tenías) a la IP nueva (paso 1 de `despliegue.md`). Hazlo ahora: la propagación tarda, y el certificado del paso 12 la necesita.
3. **Sistema.** Firewall (paso 2) y Docker (paso 3), y con Docker, `rsync` y `git`: `sudo pacman -Syu --needed rsync git` (en Arch, nunca `-S` sin `-yu`). nginx con certbot, como en el VPS de antes: allí ya estaban por naphsoft, y su configuración no está en este respaldo.
4. **Repo.** Clónalo en `/opt/dentalware` (paso 4).
5. **Repositorio de restic.** Súbelo desde tu PC a tu carpeta del VPS y, ya en él, muévelo a su sitio, solo para root:

   ```bash
   # En tu PC:
   rsync -a --delete ~/respaldos-dentalware/restic/ nelson@<IP nueva>:copia-restic/
   # En el VPS:
   sudo install -d -m 700 /var/backups/dentalware
   sudo rsync -a --delete ~/copia-restic/ /var/backups/dentalware/restic/
   sudo chown -R root:root /var/backups/dentalware/restic
   rm -rf ~/copia-restic
   ```

   El `--delete` de los dos `rsync` hace que la copia quede igual a la del PC. Sin él, una `copia-restic` vieja que ya estuviera en el VPS (la de un backup de Hostinger, en la ruta A) se mezclaría con la nueva y el repositorio no se podría leer.

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

10. **Construye sin arrancar.** Así la API no crea un esquema vacío antes de restaurar ([por qué](#por-qué-se-restaura-sobre-una-bd-vacía)):

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

    **Si `restore.sh` falla o se corta**, la API sigue sin arrancar: no hagas `dw up -d`. Corrige lo que diga el log y repite desde una BD vacía:

    ```bash
    dw rm -sf postgres
    docker volume rm dentalware_pgdata
    sudo infra/backup/restore.sh
    ```

12. **nginx y certificado.** Cuando `dig +short dentalware.naphsoft.dev` dé la IP nueva, repite el paso 8 de `despliegue.md`: el sitio, certbot y la renovación.
13. **Respaldos.** Vuelve a programarlos. Sin `--init`, porque el repositorio ya existe. Y lanza uno ahora:

    ```bash
    sudo infra/backup/install.sh --dry-run
    sudo infra/backup/install.sh
    sudo systemctl start dentalware-backup.service
    journalctl -u dentalware-backup -n 20 | grep 'Respaldo correcto'   # «Respaldo correcto: snapshot …»
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
- [ ] **El respaldo siguiente en verde:** `sudo systemctl start dentalware-backup.service` y `journalctl -u dentalware-backup -n 20 | grep 'Respaldo correcto'` da la línea de ahora. Si quieres más seguridad, lanza también el simulacro: `sudo systemctl start dentalware-restore-drill.service` → «Simulacro correcto».
- [ ] El equipo sabe qué se perdió (lo hecho después del snapshot) y lo vuelve a registrar.

## Si una restauración se interrumpe

Por un corte de luz, un `kill` o porque se cerró la sesión SSH. Se ve en que el log no termina en «Restauración completa».

- **La BD** queda entera: o como estaba, o ya restaurada. `pg_restore` va en una sola transacción.
- **La API** se queda como estaba al empezar: `restore.sh` solo la vuelve a arrancar si estaba en marcha. En el caso 1, en la ruta B y al volver atrás estaba parada y debe seguir así: **no hagas `dw up -d`**. Sobre la BD vacía, la API crearía el esquema actual y la restauración siguiente fallaría con `already exists`. Si ya la arrancaste, no pasa nada: el paso siguiente borra la BD otra vez.
- **Lo que queda en el disco:** la carpeta temporal `restaurar.*`, con el dump y las fotos **sin cifrar**. Si el script termina, la borra él; si lo cortan, no. Bórrala a mano:

  ```bash
  sudo find /var/backups/dentalware /tmp -maxdepth 1 -name 'restaurar.*'
  sudo rm -rf /var/backups/dentalware/restaurar.<xxxxxx>
  ```

  En `/tmp` solo quedan las de `--con-config` sin `.env` (caso 3, paso 7).
- **Repite** la restauración desde el paso que borra la BD (`dw rm -sf postgres` y `docker volume rm dentalware_pgdata`): el paso 4 del caso 1, o la nota del paso 11 de la ruta B. Así es segura de repetir.

Para no depender de la sesión SSH en una restauración larga, ábrela dentro de `tmux` o `screen` si están instalados.

## Si el VPS estuvo comprometido

Si alguien entró en el VPS, el repositorio de restic local, los scripts, el `.env` y los timers pueden estar manipulados. Un snapshot reciente también: el intruso pudo respaldar datos alterados. La contraseña de restic va aparte del resto de secretos: para restaurar hace falta **la vieja**, y solo después se cambia.

1. **Restaura desde fuera del VPS comprometido.** Sigue la ruta B en un VPS reinstalado, con la copia de tu PC hecha **antes** del incidente. Si solo tienes un backup de Hostinger anterior al incidente:
   1. restáuralo (ruta A, paso 1);
   2. trae su repositorio a tu PC («Copia en tu PC» en `respaldos.md`);
   3. reinstala el VPS y sigue la ruta B con esa copia.
2. **Pasos 1 a 7 de la ruta B, con la contraseña de restic vieja** (la de esa copia, de tu gestor): sin ella el repositorio no se lee.
3. **En el paso 8, rota los secretos del `.env` recuperado** antes de colocarlo, y revísalo línea a línea:
   - `POSTGRES_PASSWORD` y `BETTER_AUTH_SECRET`, con `openssl rand` como en el paso 5 de `despliegue.md`. En el paso 11, `restore.sh` crea la BD nueva con la contraseña nueva (el dump no lleva contraseñas de Postgres). El `BETTER_AUTH_SECRET` nuevo cierra todas las sesiones.
   - `ADMIN_PASSWORD` solo se usa al crear el admin: en una BD restaurada no cambia nada. La contraseña del admin se cambia en la app (punto 5).
   - Guarda el `.env` nuevo en tu gestor.
4. **Pasos 9 a 12 de la ruta B, y en el 13, un repositorio de restic nuevo** con contraseña nueva, en vez de seguir con el restaurado:

   ```bash
   sudo mv /var/backups/dentalware/restic /var/backups/dentalware/restic.anterior
   sudo sh -c 'umask 077; openssl rand -hex 32 > /etc/dentalware/restic-password'
   sudo cat /etc/dentalware/restic-password        # guárdala en tu gestor como la nueva
   sudo infra/backup/install.sh --init --dry-run    # «Haría: restic init …»
   sudo infra/backup/install.sh --init
   sudo systemctl start dentalware-backup.service
   journalctl -u dentalware-backup -n 20 | grep 'Respaldo correcto'   # «Respaldo correcto: snapshot …»
   ```

   Con el repositorio apartado, `install.sh --init` no encuentra su `config` y crea uno nuevo; si siguiera ahí, intentaría leerlo con la contraseña nueva y fallaría. Cuando el primer respaldo nuevo esté en verde, borra el apartado (`sudo rm -rf /var/backups/dentalware/restic.anterior`). La copia buena sigue en tu PC, con la contraseña vieja: guarda las dos en el gestor, cada una con su etiqueta.
5. **En la app:** cambia la contraseña de cada usuario, el admin incluido, en Configuración › Usuarios › editar › «Nueva contraseña».
6. **Fuera de la app:** cambia las claves SSH que tuviera el VPS, la contraseña de `sudo` de `nelson` y el token de la API de Hostinger.
7. **Avisa:** hay datos de pacientes (LOPDP).

## Registro de recuperaciones

Apunta cada recuperación y cada ensayo: cuánto se tardó de verdad y qué falló en esta guía.

| Fecha | Caso | Snapshot | Tiempo | Notas |
|---|---|---|---|---|
