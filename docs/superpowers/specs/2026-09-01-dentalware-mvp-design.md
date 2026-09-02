# Dentalware — Diseño del MVP (laboratorio dental, uso interno)

Fecha: 2026-09-01 · Estado: aprobado por Nelson · Alcance: MVP para un solo laboratorio

## 1. Contexto y objetivo

Software de gestión para **un laboratorio dental** en Ecuador (uso interno, 3-15 usuarios). Objetivo: MVP lo antes posible, con la **misma aplicación en PC y móvil** (técnicos en planta, dueño/administrador, mensajero de recogidas y envíos), coste mínimo de desarrollo (1 dev) y un solo lenguaje.

Referencias de partida en `docs/`: dos PDFs con la visión "DLOS" (se toma la esencia: Rx estandarizada, fases tipo kanban, remakes con motivo, fecha de entrega calculada, ticket con QR; se descarta microservicios, NAS, integración CAD/CAM, costeo ABC) y 19 capturas de VEVI Dental (se copia la estructura de módulos y la ficha de trabajo con odontograma FDI).

Investigación de mercado, dominio y stack (3 agentes Exa, 2026-09-01) confirmó que el núcleo común de todos los productos comerciales es: caso con doctor + paciente + productos × piezas × color × fecha, estados con historial, catálogo con precios (+ precio por cliente), ticket imprimible con código, cuenta por clínica, adjuntos y remake enlazado con motivo.

## 2. Decisiones fijadas

| Tema | Decisión |
|---|---|
| Lenguaje | TypeScript en todo el stack |
| Cliente | PWA responsive (React) instalable en móvil; Capacitor como envoltorio nativo opcional |
| iOS | Hay iPhones: PWA Safari-first; Capacitor iOS es la primera mejora post-MVP si hace falta push/offline |
| Fases de producción | Por trabajo (fase actual + historial); por línea de producto queda para después |
| Facturación | Solo control interno: cargos por trabajo entregado, ajustes, pagos, saldo y estado de cuenta por clínica. La factura electrónica SRI se emite fuera; solo se anota su número. IVA 15% informativo |
| Hosting | VPS Hostinger con Docker (caddy + api + postgres) |
| Documentación de librerías | Consultar siempre context7 para versión y docs vigentes antes de instalar/usar cualquier librería |

## 3. Arquitectura

Monorepo pnpm workspaces (Node 22 LTS, TypeScript strict, ESLint + Prettier, Vitest, Playwright):

```
dentalware/
  apps/
    web/        React 19 + Vite + TanStack Router (file-based) + TanStack Query
                + react-hook-form + zod + Tailwind v4 + shadcn/ui + vite-plugin-pwa
    api/        Hono (@hono/node-server) + Drizzle ORM + postgres + zod validators
                + better-auth (email/password, sesiones cookie, roles)
  packages/
    shared/     zod schemas (DTOs), enums (estados, roles), constantes FDI,
                máquina de estados del trabajo, días hábiles, formato de código
  infra/
    docker-compose.yml   caddy (TLS + estáticos de web) · api · postgres
    Caddyfile · backup.sh · .env.example
  docs/
    superpowers/specs/ · superpowers/plans/ · caputras_ejemplo/ · PDFs
```

Principios:
- **Un solo despliegue**: `docker compose up -d --build` en el VPS. Caddy sirve `apps/web/dist` y hace proxy `/api/*` a la API. TLS automático.
- **Tipado end-to-end** sin codegen: la API exporta `AppType` de Hono y el cliente usa `hc<AppType>()`. Los schemas zod viven en `packages/shared` y validan formulario y ruta.
- **Misma UI para PC y móvil**: sidebar en ≥1024px, barra inferior + FAB en móvil.
- **Archivos** (fotos, PDFs, STL pequeños): volumen Docker `/data/uploads/{caseId}/…`, servidos por la API con autenticación, miniaturas con `sharp`, límite 25 MB. Migrable a S3-compatible.
- **Impresión/PDF**: plantillas HTML con CSS `@page` + `window.print()` (ficha de trabajo con QR, nota de entrega, estado de cuenta). Sin Puppeteer.
- **QR**: la ficha impresa lleva un QR con la URL `https://<dominio>/t/<código>`; cualquier cámara de celular abre la ficha. Escáner in-app es opcional.
- **Cámara**: `<input type="file" accept="image/*" capture="environment">` (Safari iOS y Chrome Android). Compresión en cliente (≤1600px).
- **Offline**: solo caché de shell y assets (Workbox). Sin escritura offline.
- **Seguridad**: cookies HttpOnly + SameSite, roles verificados en cada ruta, precios ocultos a técnico/mensajero, rate limit en login, audit trail en `case_events`, backups diarios.

## 4. Modelo de datos (PostgreSQL, Drizzle)

Configuración:
- `lab_settings` (1 fila): nombre, RUC, dirección, teléfono, logo, prefijo de código, IVA informativo.
- `users`: name, email, role (`admin | recepcion | tecnico | mensajero`), active; tablas de sesión de better-auth.
- `clinics`: name, ruc, address, city, phone, whatsapp, email, payment_terms_days, notes, active.
- `doctors`: clinic_id, name, phone, email, notes, active.
- `product_categories`: name, sort.
- `products`: code, name, category_id, pricing_unit (`por_pieza | por_arcada | por_trabajo`), base_price, turnaround_days, requires_try_in, active.
- `clinic_product_prices`: (clinic_id, product_id) → price. Si no existe, se usa base_price.
- `stages`: name, color, sort, active. Seed: Recepción, Modelo, Diseño, Estructura, Cerámica/Acrílico, Acabado, Control de calidad.

Operación:
- `cases`: code (único, `AA-NNNNN` por año), box_number, clinic_id, doctor_id, patient_ref (alias, no nombre completo), patient_age, patient_sex, status, current_stage_id, assigned_technician_id, priority (`normal | urgente`), received_at, due_date, promised_date, finished_at, shipped_at, delivered_at, shade, shade_system (`vita_classical | vita_3d_master | otro`), observations, prescription, internal_notes, hold_reason, parent_case_id, remake_reason, remake_responsibility (`lab | doctor | compartido`), remake_charge_pct, total (cache), created_by, timestamps.
- `case_items`: case_id, product_id, description, quantity, teeth `int[]` (FDI), unit_price, discount_pct, line_total, material, notes.
- `case_tryins`: case_id, label, scheduled_for, sent_at, returned_at, notes.
- `case_events`: case_id, type (`created | status_changed | stage_changed | assigned | hold | resumed | tryin_sent | tryin_returned | comment | attachment_added | shipped | delivered | cancelled | remake_created | edited`), from_value, to_value, reason, actor_id, created_at. Historial, comentarios y auditoría.
- `attachments`: case_id, kind (`photo | document | scan`), filename, mime, size, storage_path, uploaded_by.
- `deliveries`: case_id, type (`entrega | recogida`), clinic_id, courier_id, scheduled_for, done_at, proof_attachment_id, notes, status (`pendiente | hecha | fallida`).

Cuentas:
- Cargo = trabajo `entregado` (su `total`). Sin tabla de cargos aparte.
- `account_adjustments`: clinic_id, case_id?, amount (±), reason, created_by.
- `payments`: clinic_id, amount, method (`efectivo | transferencia | tarjeta | cheque | otro`), paid_at, reference, notes, created_by.
- `invoice_refs` + `invoice_ref_cases`: número SRI emitido fuera, fecha, monto, trabajos incluidos.
- Saldo = Σ trabajos entregados + Σ ajustes − Σ pagos. Estado de cuenta por rango con saldo inicial/final y antigüedad (0-30 / 31-60 / 61-90 / 90+).

## 5. Ciclo de vida del trabajo (máquina de estados en `packages/shared`)

Estados: `nuevo → en_proceso ⇄ (en_espera | en_prueba) → terminado → enviado → entregado`, más `cancelado` desde cualquier estado distinto de `entregado`.

| Acción | Desde | Hacia | Quién | Regla |
|---|---|---|---|---|
| Aceptar | nuevo | en_proceso | admin, recepción | fija `promised_date` (días hábiles del mayor `turnaround_days`) y fase inicial |
| Cambiar fase | en_proceso | en_proceso | técnico, admin, recepción | evento con fase anterior/nueva; retroceder exige motivo |
| Asignar técnico | activo | = | admin, recepción | |
| Pausar / Reanudar | en_proceso ⇄ en_espera | | admin, recepción | motivo obligatorio |
| Enviar / Recibir prueba | en_proceso ⇄ en_prueba | | admin, recepción | crea/cierra `case_tryins` |
| Finalizar | en_proceso | terminado | admin, recepción, técnico | fase debe ser la última o confirmar |
| Marcar enviado | terminado | enviado | mensajero, recepción, admin | crea/cierra `delivery` |
| Marcar entregado | enviado | entregado | mensajero, recepción, admin | fija `delivered_at`; pasa a ser cargo |
| Repetir (remake) | terminado/enviado/entregado | nuevo caso hijo | admin, recepción | motivo + responsable + % cobro; copia líneas y odontograma |
| Cancelar | ≠ entregado | cancelado | admin, recepción | motivo obligatorio |
| Editar datos/precios | nuevo, en_proceso | = | admin, recepción | cambios de precio quedan en eventos |

## 6. Pantallas

1. Login.
2. Inicio: contadores (nuevos, en proceso, vencen hoy, atrasados, en prueba, listos, saldo por cobrar); "mis trabajos" (técnico); entregas de hoy (mensajero).
3. Trabajos: vistas rápidas (Nuevos, En curso, Deben salir hoy, Listos, Todos) + filtros; tabla en PC, tarjetas con semáforo en móvil.
4. Nuevo / editar trabajo: cabecera, odontograma FDI interactivo (SVG, selección múltiple, arrastre para puentes), líneas con precio automático por clínica, color VITA, pruebas, observaciones / prescripción / notas internas, fotos. "Guardar" y "Guardar y nuevo".
5. Ficha del trabajo: cabecera; pestañas Detalle · Fotos · Historial y comentarios · Entregas · Documentos; acciones según estado y rol.
6. `/t/:code` (QR): ficha móvil con "Avanzar fase" y "Añadir foto".
7. Entregas (mensajero): lista por día agrupada por clínica; marcar hecha con foto.
8. Cuentas: clínicas con saldo y antigüedad; movimientos; registrar pago/ajuste; anotar nº factura SRI; imprimir estado de cuenta.
9. Configuración (admin): laboratorio, usuarios, clínicas, doctores, categorías, productos, precios por clínica, fases.

Roles: `admin` todo; `recepcion` todo salvo usuarios/config; `tecnico` trabajos sin precios, fases, fotos, comentarios; `mensajero` entregas + ficha básica sin precios.

## 7. Errores y calidad de datos

- Validación zod compartida con mensajes en español.
- Transición inválida → 409 con mensaje claro; la UI solo muestra acciones válidas.
- Código de trabajo generado en transacción con secuencia por año.
- Subidas: validación MIME/tamaño; compresión en cliente.
- Toda mutación de trabajo escribe `case_event` en la misma transacción.
- Borrado lógico en catálogos; los trabajos se cancelan, nunca se borran.

## 8. Pruebas

- Unit (Vitest) en `packages/shared`: máquina de estados, días hábiles, totales y precio por clínica, FDI, código.
- API (Vitest + Postgres en Docker): crear trabajo, transiciones, pagos y saldo, permisos por rol.
- E2E (Playwright, móvil y escritorio): crear trabajo → aceptar → fases por QR → finalizar → entregar → cargo y pago → imprimir ficha.
- Desarrollo con TDD.

## 9. Despliegue y operación

- `infra/docker-compose.yml`: caddy (80/443), api (node:22-alpine multi-stage), postgres:17 con volumen, volumen uploads. Variables en `.env`.
- Migraciones Drizzle al arrancar la API. Seed: admin, fases, categorías y productos de ejemplo.
- Backup diario `pg_dump` + tar de uploads, retención 14 días; opcional `rclone` externo.
- CI GitHub Actions: lint, typecheck, tests. Deploy por SSH (`git pull && docker compose up -d --build`).

## 10. Iteraciones

0. Fundación: monorepo, tooling, `shared` (enums, FDI, máquina de estados con tests), API con auth y roles, web con layout responsive + PWA, docker-compose local.
1. Configuración: catálogos y usuarios (CRUD + seeds).
2. Trabajos I: crear/editar/listar/ficha, odontograma, líneas con precios, fotos, comentarios.
3. Trabajos II: estados y fases con historial, asignación, pausas, pruebas, remake, cancelación, dashboard, ficha imprimible con QR y `/t/:code`.
4. Entregas: recogidas y envíos, vista del mensajero, prueba con foto, nota de entrega.
5. Cuentas: saldos, pagos, ajustes, referencia SRI, estado de cuenta, antigüedad.
6. Cierre MVP: E2E, despliegue en VPS con TLS, backups, instalación de la PWA en Android e iPhone, datos reales.

Post-MVP: Capacitor iOS/Android, fases por línea, listas de precios completas, almacén con lotes (ARCSA), notificaciones WhatsApp, portal del odontólogo, facturación electrónica SRI, reportes.

## 11. Supuestos

- UI en español; moneda USD; precios sin IVA.
- Notación FDI; color texto libre con sugerencias VITA.
- Código `AA-NNNNN`; el QR codifica la URL de la ficha.
- Fases globales en MVP.
- Paciente como alias/código (LOPDP), sin ficha propia.
- Sin almacén/materiales en MVP.
