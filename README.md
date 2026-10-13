# Dentalware

Gestión interna de un laboratorio dental: trabajos, producción por fases, entregas y cuentas por clínica. Una sola app web (PWA) para PC y móvil.

## Requisitos

- Node 24 (`nvm use`), pnpm 11 (`corepack enable`), Docker.

## Desarrollo

```bash
pnpm install
pnpm db:up                      # PostgreSQL local (dev + test)
cp apps/api/.env.example apps/api/.env
pnpm build                      # compila @dentalware/shared (el seed lo importa desde dist/)
pnpm --filter @dentalware/api seed   # crea el admin inicial
pnpm dev                        # shared (watch) + api :3000 + web :5173
```

## Configuración inicial

Tras el `seed`, entra como administrador y completa **Configuración**: datos del laboratorio (nombre, dirección, teléfonos), fases de producción (se crean 7 por defecto), categorías y productos (se crean los 6 de la orden en papel con precio base 0.00: pon los precios reales), clínicas con sus doctores y precios especiales, y los usuarios del equipo con su rol (recepción, técnico, mensajero). Los técnicos y mensajeros nunca ven precios.

## Trabajos

Recepción registra cada orden en **Trabajos → Nuevo trabajo** siguiendo la hoja en papel: clínica y doctor, referencia del paciente, líneas de trabajo con piezas FDI en el odontograma, color VITA, lista de verificación (antagonista, mordida, color, fotos) y observaciones. El precio sale del catálogo y de los precios especiales de la clínica; técnicos y mensajeros nunca ven montos. La ficha guarda fotos (comprimidas en el navegador) y comentarios con historial. **Importar** acepta la plantilla CSV descargable (una fila por línea de trabajo) y muestra los errores por fila antes de crear nada. Los archivos se guardan en `UPLOAD_DIR` (volumen `uploads` en producción).

## Calidad

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm e2e
```

Spec: `docs/superpowers/specs/2026-09-01-dentalware-mvp-design.md`.

## Despliegue (VPS con Docker)

Guía paso a paso del VPS de producción (nginx con certbot delante, subdominio `dentalware.naphsoft.dev`): [`docs/operacion/despliegue.md`](docs/operacion/despliegue.md). Lo de abajo es el resumen para un VPS sin otro servidor web.

```bash
git clone <repo> /opt/dentalware && cd /opt/dentalware
cp infra/.env.example infra/.env   # editar dominio, claves y admin
docker compose -p dentalware -f infra/docker-compose.yml --env-file infra/.env up -d --build
docker compose -p dentalware -f infra/docker-compose.yml --env-file infra/.env run --rm api node dist/scripts/seed.js
```

Caddy obtiene el certificado TLS automáticamente para `SITE_ADDRESS`. Respaldos: `infra/backup/` (restic, repositorio cifrado en el servidor; variables `RESTIC_*` y `BACKUP_*` de `infra/.env.example`), programados con `sudo infra/backup/install.sh --init`: respaldo diario, verificación semanal y simulacro mensual.
Actualizar: `git pull && docker compose -p dentalware -f infra/docker-compose.yml --env-file infra/.env up -d --build`.

### Restaurar

```bash
sudo infra/backup/restore.sh --snapshot latest                     # BD y fotos del último respaldo
sudo infra/backup/restore.sh --solo-archivos '<caseId>/<id>.jpg'   # un adjunto borrado, sin tocar la BD
sudo infra/backup/restore.sh --con-config /tmp/config-respaldada   # la configuración, para revisarla
```

El job `respaldo` de CI (`infra/tests/backup-roundtrip.sh`) respalda, borra todo y restaura en cada PR.

Qué se respalda, cuándo y cómo vigilarlo: [`docs/operacion/respaldos.md`](docs/operacion/respaldos.md). Recuperar la BD a una fecha, fotos borradas o el VPS entero: [`docs/operacion/recuperacion.md`](docs/operacion/recuperacion.md).
