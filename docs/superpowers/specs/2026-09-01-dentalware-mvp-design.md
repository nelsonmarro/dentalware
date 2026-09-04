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

Monorepo pnpm workspaces (Node 24 LTS, TypeScript strict, ESLint + Prettier, Vitest, Playwright):

```
dentalware/
  apps/
    web/        React 19 + Vite + TanStack Router (file-based) + TanStack Query
                + react-hook-form + zod + Tailwind v4 + shadcn/ui + vite-plugin-pwa
    api/        Hono (@hono/node-server) + Drizzle ORM + postgres + zod validators
                + better-auth (email/password, sesiones cookie, roles)
                Drizzle ORM 1.0 RC (relaciones v2) fijado en versión exacta; TypeScript 6.0.x hasta que typescript-eslint soporte 7.x.
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
- `payment_allocations`: (payment_id, case_id, amount). Un pago se reparte entre trabajos entregados de la clínica (por defecto los más antiguos primero, editable); cuando la suma asignada a un trabajo alcanza su `total`, el trabajo pasa a `cobrado`. Vista "Por cobrar" por trabajo con días desde la entrega.

## 5. Ciclo de vida del trabajo (máquina de estados en `packages/shared`)

Estados: `por_recoger → nuevo → en_proceso ⇄ (en_espera | en_prueba) → terminado → enviado → entregado → cobrado`, más `cancelado` desde cualquier estado distinto de `entregado` y `cobrado`. (Ampliado el 2026-09-04: `por_recoger` coordina la recogida con el mensajero antes de recibir el trabajo; `cobrado` cierra la orden cuando el pago cubre su total. La máquina de estados de `packages/shared` implementada en la Iteración 0 se amplía en la Iteración 3.)

Color de cada estado (chip + texto, nunca solo color): `por_recoger` gris azulado `#6B7C93`; `nuevo` `--teal-lab-soft` con texto `--teal-lab`; `en_proceso` `--teal-lab`; `en_espera` `--wax-amber`; `en_prueba` violeta `#7C5CBF`; `terminado` verde claro `#8CC9A6`; `enviado` azul `#2F6FB0`; `entregado` `--ok-green`; `cobrado` `--graphite`; `cancelado` `--articulating-red`. Los mismos colores se usan en la lista, la tarjeta móvil, el tablero, el calendario y la ficha impresa.

| Acción | Desde | Hacia | Quién | Regla |
|---|---|---|---|---|
| Programar recogida | (nuevo caso) | por_recoger | admin, recepción | crea `delivery` tipo `recogida` asignada al mensajero con fecha; avisa por WhatsApp al mensajero y a la clínica |
| Recibir | por_recoger | nuevo | mensajero, recepción, admin | cierra la recogida; el trabajo queda como recibido. Un trabajo que la clínica trae directamente se crea en `nuevo` |
| Aceptar | nuevo | en_proceso | admin, recepción | exige los datos obligatorios completos (§7); fija `promised_date` (días hábiles del mayor `turnaround_days`) y fase inicial |
| Cambiar fase | en_proceso | en_proceso | técnico, admin, recepción | evento con fase anterior/nueva; retroceder exige motivo |
| Asignar técnico | activo | = | admin, recepción | |
| Pausar / Reanudar | en_proceso ⇄ en_espera | | admin, recepción | motivo obligatorio |
| Enviar / Recibir prueba | en_proceso ⇄ en_prueba | | admin, recepción | crea/cierra `case_tryins` |
| Finalizar | en_proceso | terminado | admin, recepción, técnico | fase debe ser la última o confirmar |
| Marcar enviado | terminado | enviado | mensajero, recepción, admin | crea/cierra `delivery` |
| Marcar entregado | enviado | entregado | mensajero, recepción, admin | fija `delivered_at`; pasa a ser cargo |
| Registrar cobro | entregado | cobrado | admin, recepción | automático al aplicar pagos que cubran el `total` del trabajo (§4 `payment_allocations`); fija `paid_at` y cierra la orden |
| Repetir (remake) | terminado/enviado/entregado | nuevo caso hijo | admin, recepción | motivo + responsable + % cobro; copia líneas y odontograma |
| Cancelar | ≠ entregado, ≠ cobrado | cancelado | admin, recepción | motivo obligatorio |
| Editar datos/precios | nuevo, en_proceso | = | admin, recepción | cambios de precio quedan en eventos |

### Orden de trabajo actual del laboratorio (referencia obligatoria)
La orden en papel que usa hoy el laboratorio **Arte Dental** (`docs/planilla de ingreso actual.jpeg`; talonario con original para el cliente y copia celeste para el emisor) define los campos mínimos del formulario digital y el diseño de la ficha impresa:

| Bloque en papel | En Dentalware |
|---|---|
| Encabezado: logo, "Arte Dental", dirección Puerto Rico N27-33 y La Isla, celulares, número de orden | `lab_settings` (nombre, dirección, teléfonos, logo) + código del trabajo `AA-NNNNN` y QR en la ficha impresa |
| Clínica / Doctor, Paciente, Edad, M/F, Fecha ingreso, Fecha entrega | `clinic_id`, `doctor_id`, `patient_ref` (alias), `patient_age`, `patient_sex`, `received_at`, `due_date`/`promised_date` |
| Color, Referencia, esquemas de arcada y de pieza | `shade` + `shade_system` (VITA), campo `reference` (referencia de color/guía), imágenes del odontograma seleccionado en la ficha impresa |
| Numeración dental 18…28 / 48…38 | odontograma FDI interactivo (mismo orden y numeración) |
| Descripción de trabajo: Prótesis fija (Zirconio, Disilicato de litio, Metal porcelana) · Prótesis removible (Acrílico, Cromo cobalto, Prótesis híbrida) | seeds de `product_categories` (Prótesis fija, Prótesis removible) y `products` iniciales con esos seis nombres; el catálogo es editable en Configuración |
| Observaciones (líneas) | `observations` / `prescription` |
| IMPORTANTE: Enviar antagonista, mordida, color, fotos | lista de verificación de lo que la clínica debe entregar; forma parte de los **datos obligatorios al recibir** (§7): se marca lo recibido y lo que falta bloquea Aceptar o queda registrado como pendiente con aviso a la clínica |
| Firmas: Técnico responsable · Dr./Cliente | `assigned_technician_id` y constancia de entrega (firma o foto) en Entregas |

La ficha imprimible (Iteración 3) reproduce esta hoja en A5/A4 con los mismos bloques y orden, para que el equipo y las clínicas la reconozcan; se imprime en dos copias (cliente y laboratorio) o se envía en PDF por WhatsApp.

### Importación de trabajos
Plantilla CSV/XLSX descargable (una fila por línea de trabajo: clínica, doctor, referencia de paciente, producto, piezas FDI, color, fecha deseada, observaciones). La importación valida cada fila con los mismos schemas zod que el formulario, muestra un informe de errores por fila y solo crea los trabajos cuando el archivo está limpio. Sirve para migrar el histórico de VEVI y para clínicas que envían pedidos en hoja de cálculo.

### Notificaciones y calendario
- **WhatsApp** (canal principal de aviso a clínicas y mensajero): mensajes al programar recogida, al recibir, al enviar, al entregar y **recordatorio un día antes** de la fecha comprometida de entrega. Integración con la API oficial de WhatsApp Business (Meta Cloud API) con plantillas aprobadas; mientras no exista la cuenta verificada, enlace `wa.me` con el mensaje prellenado que recepción envía con un toque. Cada envío queda en `notifications` (destinatario, canal, plantilla, estado).
- **Calendario de entregas**: vista mensual/semanal de recogidas y entregas por clínica y mensajero; cada trabajo aceptado crea su evento en la fecha comprometida; feed ICS por clínica para que lo vean en su propio calendario; alarma interna y WhatsApp **un día antes**.

### Productividad del personal
- **Producción por persona**: por técnico y período: trabajos y fases completadas, piezas, tiempo por fase, a tiempo vs. atrasadas, repeticiones atribuibles. Se calcula desde `case_events` (cada cambio de fase registra actor y fecha).
- **Puntos de recompensa y penalización**: reglas configurables por el administrador (p. ej. +puntos por fase cerrada a tiempo o por trabajo sin repetición; −puntos por atraso o repetición atribuible al técnico), tablero mensual por persona y exportación. Los puntos nunca alteran los datos del trabajo; son una vista derivada de los eventos.

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

- Datos obligatorios al recibir un trabajo (no se puede **Aceptar** sin ellos): clínica, doctor, referencia de paciente, al menos una línea con producto y piezas FDI o arcada, fecha deseada, color cuando el producto lo exige, y foto o documento de la prescripción si la clínica no la entregó en papel; además la lista de verificación de la orden en papel (antagonista, mordida, color, fotos) con lo recibido marcado. El formulario marca lo que falta y la API lo rechaza con 422 y mensajes en español.

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

- `infra/docker-compose.yml`: caddy (80/443), api (node:24-alpine multi-stage), postgres:17 con volumen, volumen uploads. Variables en `.env`.
- Migraciones Drizzle al arrancar la API. Seed: admin, fases, categorías y productos de ejemplo.
- Backup diario `pg_dump` + tar de uploads, retención 14 días; opcional `rclone` externo.
- CI GitHub Actions: lint, typecheck, tests. Deploy por SSH (`git pull && docker compose up -d --build`).

## 10. Iteraciones

0. Fundación: monorepo, tooling, `shared` (enums, FDI, máquina de estados con tests), API con auth y roles, web con layout responsive + PWA, docker-compose local.
1. Configuración: catálogos y usuarios (CRUD + seeds).
2. Trabajos I: crear/editar/listar/ficha, odontograma, líneas con precios, fotos, comentarios.
3. Trabajos II: estados y fases con historial, asignación, pausas, pruebas, remake, cancelación, dashboard, ficha imprimible con QR y `/t/:code`.
4. Entregas y calendario: recogidas coordinadas con el mensajero (`por_recoger`), envíos, vista del mensajero, prueba con foto, nota de entrega, calendario de entregas con feed ICS.
5. Cuentas y cobro: saldos, pagos con asignación por trabajo, cierre `cobrado`, ajustes, referencia SRI, estado de cuenta, antigüedad, vista "Por cobrar".
6. Notificaciones: WhatsApp (Meta Cloud API con plantillas; `wa.me` como respaldo) para recogida, recepción, envío, entrega y recordatorio un día antes; alarmas internas.
7. Productividad: producción por persona y sistema de puntos de recompensa/penalización configurable.
8. Cierre MVP: E2E, despliegue en VPS con TLS, backups, instalación de la PWA en Android e iPhone, importación del histórico y datos reales.

Post-MVP: Capacitor iOS/Android, fases por línea, listas de precios completas, almacén con lotes (ARCSA), portal del odontólogo, facturación electrónica SRI.

Cambios del 2026-09-04 (pedido de Nelson): recogida coordinada con el mensajero, cierre al cobrar con énfasis en pagos, colores por estado, validación de datos obligatorios al recibir, formato de importación, alertas por WhatsApp y calendario de entregas con aviso un día antes, producción por persona y sistema de puntos. La Iteración 1 (Configuración) no cambia; la máquina de estados de `shared` se amplía en la 3.

## 11. Supuestos

- UI en español; moneda USD; precios sin IVA.
- Notación FDI; color texto libre con sugerencias VITA.
- Código `AA-NNNNN`; el QR codifica la URL de la ficha.
- Fases globales en MVP.
- Paciente como alias/código (LOPDP), sin ficha propia.
- Sin almacén/materiales en MVP.
