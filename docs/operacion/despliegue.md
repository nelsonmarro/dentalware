# Despliegue de Dentalware en el VPS de Hostinger

Guía paso a paso para poner en marcha Dentalware completo (web, API y base de datos) en el VPS `srv1278438.hstgr.cloud` (82.25.95.39, Arch Linux). Escrita el 2026-10-10 a partir del estado real del VPS.

> **Antes de cargar datos reales** (trabajos, pagos, fotos de pacientes) tienen que estar listos los respaldos definitivos fuera del VPS y haberse probado una recuperación: PR 2 de la Iteración 7, #111. Con esta guía puedes desplegar y dejar configurado el laboratorio ya; los respaldos provisionales del paso 12 cubren mientras tanto.

## Cómo queda montado

```
Internet ──443──▶ nginx del VPS (TLS con certbot; ya sirve naphsoft.dev)
                    │
                    ├── naphsoft.dev ───────────▶ /opt/naphsoft/server (:3000)   ← no se toca
                    │
                    └── dentalware.naphsoft.dev ─▶ 127.0.0.1:8080
                                                   │  Docker (proyecto «dentalware»)
                                                   ▼
                                       caddy (web + proxy /api) ──▶ api (Node 24) ──▶ postgres 17
                                                                     │
                                                                     └── volumen uploads (fotos)
```

- **nginx del VPS:** sigue siendo el único que escucha en 80/443. Añadimos un sitio para el dominio de Dentalware y certbot le saca el certificado.
- **Contenedores:** el `docker-compose.yml` del repo levanta tres (`caddy`, `api` y `postgres`). Un archivo de ajuste local (paso 6) hace que Caddy escuche solo en `127.0.0.1:8080`, por HTTP, sin pelear por los puertos.
- **Migraciones:** la API migra la base de datos sola al arrancar.
- **Puertos:** Postgres no se publica fuera de Docker.

Tiempo estimado: 1 h la primera vez, más la propagación del DNS.

## Lo que necesitas a mano

- [ ] Acceso SSH: `ssh nelson@82.25.95.39`. Ya funciona con tu clave. `root` no entra con las claves de tu PC: usa `nelson` + `sudo`.
- [ ] La contraseña de `sudo` de `nelson`.
- [ ] Acceso a tu cuenta de **Porkbun**, donde está el DNS de `naphsoft.dev`. El dominio no está en Hostinger.
- [ ] Tu gestor de contraseñas abierto, para guardar los secretos que se generan.

Dentalware vivirá en **`dentalware.naphsoft.dev`**, un subdominio libre de `naphsoft.dev`. Si prefieres otro nombre (por ejemplo `lab` o `artedental`), cambia `dentalware.naphsoft.dev` en todos los comandos. Todo lo que empieza por `sudo` te pedirá tu contraseña.

---

## Paso 1 — DNS en Porkbun

En Porkbun › Domain Management › `naphsoft.dev` › DNS, añade estos registros (los mismos que ya tienen `naphsoft.dev` y `docs.verith`, con la misma IP):

| Tipo | Host | Respuesta | TTL |
|---|---|---|---|
| A | `dentalware` | `82.25.95.39` | 600 |
| AAAA (opcional) | `dentalware` | `2a02:4780:2d:a9fe::1` | 600 |

Añade el AAAA solo si nginx escucha en IPv6 (el sitio del paso 8 lo hace). Si dudas, deja solo el A.

Comprueba desde tu PC, hasta que devuelva la IP. Puede tardar de minutos a un par de horas:

```bash
dig +short dentalware.naphsoft.dev
# 82.25.95.39
```

## Paso 2 — Firewall de Hostinger

Hoy tiene 0 reglas: todo está abierto. En hPanel › VPS › Reglas del firewall, crea un grupo con:

| Acción | Protocolo | Puerto | Origen |
|---|---|---|---|
| Aceptar | TCP | 22 | Cualquiera (o solo tu IP, si es fija) |
| Aceptar | TCP | 80 | Cualquiera |
| Aceptar | TCP | 443 | Cualquiera |
| Descartar | Todo | Todo | Cualquiera |

Asígnalo al VPS. Después comprueba que sigues entrando por SSH y que `https://naphsoft.dev` sigue respondiendo.

> El puerto 3000 de naphsoft hoy escucha en todas las interfaces (`*:3000`). Con este firewall deja de estar expuesto, y nginx sigue llegando a él por `localhost`.

## Paso 3 — Instalar Docker (Arch)

En Arch no se hacen actualizaciones parciales: instalar paquetes va con `-Syu`, que actualiza todo el sistema, incluido el kernel. Hazlo en un momento en que pueda reiniciarse el VPS: naphsoft se cae un par de minutos.

```bash
ssh nelson@82.25.95.39

sudo pacman -Syu docker docker-compose docker-buildx
sudo systemctl enable --now docker.service

# Para usar docker sin sudo. Ojo: el grupo docker equivale a root en esta máquina.
sudo usermod -aG docker nelson

# Si pacman actualizó el kernel (linux), reinicia; si no, basta con salir y volver a entrar.
sudo reboot
```

Al volver a entrar:

```bash
docker run --rm hello-world          # «Hello from Docker!»
docker compose version               # v2.24 o más nuevo (hace falta para «!override» del paso 6)
systemctl is-active nginx naphsoft   # active / active: lo de antes sigue en pie
```

## Paso 4 — Clonar el repositorio

El repositorio es público: no hace falta clave de despliegue.

```bash
sudo mkdir -p /opt/dentalware
sudo chown nelson:nelson /opt/dentalware
git clone https://github.com/nelsonmarro/dentalware.git /opt/dentalware
cd /opt/dentalware
git log --oneline -1                 # el último commit de main
```

## Paso 5 — El `.env` de producción

```bash
cd /opt/dentalware
cp infra/.env.example infra/.env
chmod 600 infra/.env

# Genera los secretos (cópialos a tu gestor de contraseñas a medida que los pegues):
openssl rand -base64 24   # → POSTGRES_PASSWORD
openssl rand -base64 32   # → BETTER_AUTH_SECRET
openssl rand -base64 18   # → ADMIN_PASSWORD (la contraseña con la que entrarás como admin)

nano infra/.env
```

Deja `infra/.env` así, con tus valores:

```dotenv
# Detrás del nginx del VPS: Caddy sirve HTTP interno; el TLS lo pone nginx.
SITE_ADDRESS=:80
# URL pública con https: se incrusta en la web (QR de la orden impresa) y en las cookies.
PUBLIC_URL=https://dentalware.naphsoft.dev

POSTGRES_USER=dentalware
POSTGRES_PASSWORD=<el primero que generaste>
POSTGRES_DB=dentalware

BETTER_AUTH_SECRET=<el segundo>

ADMIN_EMAIL=<tu correo de admin>
ADMIN_PASSWORD=<el tercero>
ADMIN_NAME=Nelson
```

- Sin espacios alrededor del `=`, ni comillas.
- Si una contraseña generada tiene `/` o `+` y te da problemas en la URL de la BD, genera otra con `openssl rand -hex 24`.
- Guarda **el `.env` completo** en tu gestor: sin él no se levanta el sistema en otro VPS.

## Paso 6 — Ajuste local: Dentalware detrás de nginx

Estos dos archivos viven solo en el VPS, al lado del `.env`. No están en el repositorio porque son propios de este servidor.

**6.1.** `infra/docker-compose.vps.yml`: Caddy solo en `127.0.0.1:8080`.

```bash
cat > /opt/dentalware/infra/docker-compose.vps.yml <<'EOF'
# Dentalware detrás del nginx del VPS (que tiene 80/443 y el TLS con certbot).
# Caddy solo sirve HTTP en 127.0.0.1:8080; nadie de fuera llega a él directamente.
services:
  caddy:
    ports: !override
      - '127.0.0.1:8080:80'
    environment:
      SITE_ADDRESS: ':80'
    volumes:
      - ./Caddyfile.vps:/etc/caddy/Caddyfile:ro
EOF
```

**6.2.** `infra/Caddyfile.vps`: el `Caddyfile` del repo más una línea que le dice a Caddy que se fíe del nginx de delante. Sin ella, el límite de intentos de login contaría a todos los usuarios como si fueran uno.

```bash
cd /opt/dentalware
{ printf '{\n\tservers {\n\t\ttrusted_proxies static private_ranges\n\t}\n}\n\n'; cat infra/Caddyfile; } > infra/Caddyfile.vps
head -8 infra/Caddyfile.vps
```

**6.3.** Un atajo para no escribir el comando largo cada vez:

```bash
cat >> ~/.bashrc <<'EOF'
alias dw='docker compose -p dentalware -f /opt/dentalware/infra/docker-compose.yml -f /opt/dentalware/infra/docker-compose.vps.yml --env-file /opt/dentalware/infra/.env'
EOF
source ~/.bashrc
dw config --quiet && echo "configuración válida"
```

A partir de aquí, `dw …` es `docker compose …` con todo lo de Dentalware.

## Paso 7 — Construir y arrancar

La primera vez tarda unos minutos: compila la web y la API.

```bash
cd /opt/dentalware
dw up -d --build
dw ps
```

Espera a que los tres estén `running`, con `api` y `postgres` en `(healthy)`:

```bash
watch -n 5 'docker compose -p dentalware ps'
# Ctrl+C cuando estén healthy
curl -s http://127.0.0.1:8080/api/health   # responde OK
dw logs api --tail 30                      # «API escuchando en http://localhost:3000 (production)»
```

Si `api` no arranca, `dw logs api` dice qué variable del `.env` falta o está mal. Corrígela y repite `dw up -d`.

## Paso 8 — El sitio en nginx y el certificado

**8.1.** El sitio, primero solo por HTTP:

```bash
sudo tee /etc/nginx/sites-available/dentalware > /dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name dentalware.naphsoft.dev;

    # Fotos y adjuntos: la API acepta hasta 25 MB (nginx, por defecto, solo 1 MB).
    client_max_body_size 30m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
EOF
sudo ln -s /etc/nginx/sites-available/dentalware /etc/nginx/sites-enabled/dentalware
sudo nginx -t && sudo systemctl reload nginx
curl -sI http://dentalware.naphsoft.dev | head -3     # 200 desde tu PC
```

**8.2.** El certificado. certbot ya está instalado y es el que usa naphsoft:

```bash
sudo certbot --nginx -d dentalware.naphsoft.dev
# Acepta la redirección de HTTP a HTTPS si lo pregunta.
sudo nginx -t && sudo systemctl reload nginx
```

**8.3.** La renovación automática. Comprueba que hay un timer que renueve:

```bash
systemctl list-timers | grep -i certbot
```

Si no sale nada, créalo; servirá también para los certificados de naphsoft:

```bash
sudo tee /etc/systemd/system/certbot-renew.service > /dev/null <<'EOF'
[Unit]
Description=Renovar certificados de Let's Encrypt
[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet --deploy-hook "systemctl reload nginx"
EOF
sudo tee /etc/systemd/system/certbot-renew.timer > /dev/null <<'EOF'
[Unit]
Description=Renovar certificados dos veces al día
[Timer]
OnCalendar=*-*-* 03,15:00:00
RandomizedDelaySec=1h
Persistent=true
[Install]
WantedBy=timers.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now certbot-renew.timer
sudo certbot renew --dry-run
```

## Paso 9 — Crear el administrador y los catálogos iniciales

Una sola vez. Es idempotente: repetirlo no duplica nada.

```bash
dw run --rm api node apps/api/dist/scripts/seed.js
# «Admin creado: …» y «Catálogos iniciales listos»
```

> Cuando se mergee el PR 2 de la Iteración 7 (imagen de la API más liviana, #23), el comando pasa a ser `dw run --rm api node dist/scripts/seed.js`.

## Paso 10 — Comprobar que todo funciona

Desde tu PC y tu celular:

- [ ] `https://dentalware.naphsoft.dev` abre con candado válido y sin avisos.
- [ ] Entras con `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- [ ] `curl -sI https://dentalware.naphsoft.dev/login | grep -i -E 'strict-transport|cache-control'` trae `strict-transport-security`.
- [ ] Creas una clínica y un trabajo de prueba y le **subes una foto** desde el celular. Así compruebas el límite de 30 MB de nginx y el volumen de fotos.
- [ ] Imprimes la orden: el QR abre `https://dentalware.naphsoft.dev/t/<código>`.
- [ ] Las herramientas de desarrollo del navegador no muestran errores en la consola.
- [ ] `https://naphsoft.dev` sigue funcionando.
- [ ] Borras (cancelas) el trabajo de prueba.

## Paso 11 — Configurar el laboratorio

Entra como admin y completa **Configuración**, en este orden:

1. **Laboratorio:** nombre (sale en el aviso por WhatsApp y en el estado de cuenta), RUC, dirección, teléfono y logo.
2. **Fases de producción:** se crean 7 por defecto; ajústalas.
3. **Productos:** se crean los 6 de la orden en papel con precio 0.00; pon los precios reales y añade los que falten.
4. **Clínicas:** cada una con sus doctores, dirección, ciudad, teléfono, **WhatsApp** en formato `+593…` y precios especiales.
5. **Usuarios:** uno por persona del equipo, con su rol (recepción, técnico o mensajero). Técnicos y mensajeros nunca ven precios.
6. **Saldo inicial** de cada clínica que ya deba algo: Cuentas › la clínica › Registrar ajuste › «Saldo inicial».

## Paso 12 — Respaldos

**Provisionales** (desde hoy hasta que se mergee el PR 2): copia diaria en el VPS y copia semanal a tu PC.

```bash
sudo mkdir -p /opt/dentalware-backups
echo 'BACKUP_DIR=/opt/dentalware-backups' >> /opt/dentalware/infra/.env

sudo tee /etc/systemd/system/dentalware-backup.service > /dev/null <<'EOF'
[Unit]
Description=Respaldo diario de Dentalware (provisional)
Requires=docker.service
After=docker.service
[Service]
Type=oneshot
ExecStart=/opt/dentalware/infra/backup.sh
EOF
sudo tee /etc/systemd/system/dentalware-backup.timer > /dev/null <<'EOF'
[Unit]
Description=Respaldo diario de Dentalware a las 03:00
[Timer]
OnCalendar=*-*-* 03:00:00 America/Guayaquil
Persistent=true
[Install]
WantedBy=timers.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now dentalware-backup.timer
sudo systemctl start dentalware-backup.service     # el primero, ahora
journalctl -u dentalware-backup -n 5               # «backup ok: db_… uploads_…»
ls -lh /opt/dentalware-backups
```

Una vez por semana, **desde tu PC**, trae la copia fuera del VPS:

```bash
rsync -av --delete nelson@82.25.95.39:/opt/dentalware-backups/ ~/respaldos-dentalware/
```

Esas copias no están cifradas y llevan datos de pacientes: guárdalas en un disco cifrado.

**Definitivos:** cuando se mergee el PR 2 de la Iteración 7 llegan restic con cifrado y Backblaze B2, avisos si fallan, el simulacro mensual y la guía de recuperación. Entonces se sustituyen los provisionales siguiendo `docs/operacion/respaldos.md`. Hasta haber pasado ese simulacro, nada de datos reales.

## Paso 13 — Instalar la app en los celulares

En cada teléfono, con el dominio ya en HTTPS:

- **Android (Chrome):** abre `https://dentalware.naphsoft.dev` › menú ⋮ › «Instalar aplicación».
- **iPhone (Safari):** abre la URL › Compartir › «Añadir a pantalla de inicio».

Comprueba (es la prueba pendiente de PEM-1, #91 y #25):
- [ ] el icono y el nombre «Dentalware»;
- [ ] que abre a pantalla completa, sin barra del navegador;
- [ ] que sin sesión abre en el login;
- [ ] que la cámara funciona al subir una foto.

Haz una captura de cada uno para cerrar el issue.

---

## Actualizar a una versión nueva

```bash
cd /opt/dentalware
sudo systemctl start dentalware-backup.service      # respaldo antes de tocar nada
git pull
# Si el Caddyfile del repo cambió, regenera el del VPS (paso 6.2):
git diff --stat HEAD@{1} -- infra/Caddyfile
{ printf '{\n\tservers {\n\t\ttrusted_proxies static private_ranges\n\t}\n}\n\n'; cat infra/Caddyfile; } > infra/Caddyfile.vps
dw up -d --build
dw ps                                               # healthy
dw logs api --tail 20
```

- Las migraciones de la base de datos se aplican solas al arrancar la API.
- Si cambias `PUBLIC_URL`, hace falta `--build`, porque va dentro de la web.
- En los celulares, la app se actualiza sola al cerrarla y volver a abrirla.

**Volver atrás** si algo sale mal:

```bash
git log --oneline -5
git checkout <commit-anterior>
dw up -d --build
```

Si la versión nueva ya migró la base de datos, volver atrás el código no basta: restaura el respaldo de antes de actualizar.

## Mantenimiento y problemas frecuentes

| Qué | Cómo |
|---|---|
| Ver si todo está arriba | `dw ps` |
| Logs de la API / de Caddy | `dw logs api --tail 100`, `dw logs caddy --tail 100` |
| Reiniciar un servicio | `dw restart api` |
| Parar todo / arrancar | `dw down` / `dw up -d` (sin `-v`: **`down -v` borra la BD y las fotos**) |
| Espacio en disco | `df -h /`, `docker system df` |
| Liberar imágenes viejas | `docker image prune` (nunca `docker volume prune`) |
| nginx | `sudo nginx -t`, `sudo systemctl reload nginx`, `sudo journalctl -u nginx -n 50` |
| Entrar a la base de datos | `dw exec postgres psql -U dentalware -d dentalware` |
| 502 Bad Gateway | la API o Caddy están caídos: `dw ps`, `dw logs api` |
| 413 al subir una foto | falta `client_max_body_size 30m` en el sitio de nginx (paso 8.1) |
| «Demasiados intentos» en el login para todos | falta `trusted_proxies` en `Caddyfile.vps` (paso 6.2) |
| El QR de la orden apunta a otro sitio | `PUBLIC_URL` mal puesto: corrígelo y `dw up -d --build` |

## Lista final

- [ ] DNS apuntando al VPS y firewall con solo 22/80/443.
- [ ] Docker instalado; naphsoft sigue funcionando.
- [ ] `infra/.env` con `chmod 600` y copiado al gestor de contraseñas.
- [ ] `dw ps`: los tres contenedores sanos.
- [ ] HTTPS válido y renovación automática del certificado.
- [ ] Admin creado y laboratorio configurado.
- [ ] Respaldo provisional diario funcionando y copiado a tu PC.
- [ ] App instalada y probada en un Android y un iPhone.
- [ ] **Antes de datos reales:** respaldos definitivos (PR 2) y simulacro de recuperación pasado.
