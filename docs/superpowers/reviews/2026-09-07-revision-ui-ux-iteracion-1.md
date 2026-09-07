# Revisión UI/UX — Iteración 1 (Configuración)

Fecha: 2026-09-07 · Revisor: Claude (frontend-design + chrome-devtools-mcp) · Issue: #49 · Rama: `fix/revision-ui-ux-it1-it2`

## Resumen ejecutivo

Configuración cumple bien la dirección de diseño: tokens de color, tipografía, la pestaña de color del ticket en login, chips con texto y la conversión tabla→tarjeta en móvil funcionan de forma consistente y sin scroll horizontal en ninguna pantalla probada. El hallazgo más importante es sistémico: casi todos los botones de acción por fila (Editar, Bloquear/Desbloquear, Subir/Bajar fase) y el botón "Cerrar sesión" miden 28–32 px, por debajo del mínimo de 44 px que exige la dirección de diseño para técnicos con guantes y mensajeros — mientras que los botones primarios ("Nuevo usuario", etc.) sí cumplen 44 px, lo que confirma que fue una omisión puntual y no una decisión. Junto a esto hay contrastes de rojo bajo AA, una tabla que exige scroll interno a 1280 px, un formulario cuyo botón primario no ocupa el ancho completo en móvil y dos fases con el mismo color (coincidente con el teal primario). Ningún hallazgo requiere rediseño: todos son ajustes acotados sobre componentes ya existentes.

## Pantallas × viewport

| Pantalla | 1280×800 | 390×844 | 360×740 |
|---|---|---|---|
| Login (+ contraseña incorrecta) | OK (UX1-02) | OK | OK |
| Cascarón (sidebar / barra inferior / cerrar sesión) | UX1-01 | UX1-01 | OK |
| Inicio | OK | OK | — |
| Configuración → Laboratorio | UX1-08 | UX1-05 | — |
| Usuarios (crear técnico, bloquear) | UX1-01, UX1-02 | UX1-01 | OK |
| Clínicas (lista, crear) | UX1-01, UX1-07 | UX1-01, UX1-09 | OK |
| Clínica → detalle (doctores, precios especiales) | UX1-01, UX1-04 | UX1-01, UX1-04 | — |
| Productos y categorías | UX1-01, UX1-03, UX1-10 | UX1-01 | — |
| Fases (reordenar) | UX1-01, UX1-06 | UX1-01 | — |

`—` = no recorrida a este ancho por ser una repetición de un patrón ya verificado en 390/1280 sin diferencias (login, usuarios y fases sí se confirmaron a 360 sin nuevos hallazgos ni scroll horizontal).

## Hallazgos

### Critical

**UX1-01 — Objetivos táctiles muy por debajo de 44 px en acciones de fila y en "Cerrar sesión"**
Pantallas: Usuarios, Clínicas, Doctores, Productos, Fases, cascarón · Viewports: 1280, 390, 360
Evidencia (medido con `getBoundingClientRect`):
- Botón "Editar" (icono lápiz): 32 × 32 px en las 5 tablas.
- Botón "Bloquear"/"Desbloquear": 74.7 × 28 px.
- Botones "Subir"/"Bajar" fase: 32 × 32 px.
- Switches de activo/inactivo: 32 × 18.4 px.
- Botón "Cerrar sesión" (sidebar PC y cabecera móvil): 32 × 32 px en ambos casos.
- Por contraste, los botones primarios "Nuevo usuario"/"Nueva clínica"/"Nuevo producto"/"Nueva fase" sí miden 44 px (`h-11`), confirmando que el ajuste faltó solo en las acciones secundarias.

Causa: `apps/web/src/components/ui/button.tsx` define `size: icon` = `size-8` (32 px), `sm` = `h-7` (28 px), `default` = `h-8` (32 px); ningún tamaño llega a 44 px salvo el `h-11` aplicado manualmente a los CTAs primarios. Estos tamaños se usan directamente en `apps/web/src/features/doctors/doctors-table.tsx:21`, `clinics-table.tsx:31`, `users-table.tsx:26-42`, `stages-table.tsx:31-47`, `products/products-table.tsx:22`, `products/categories-list.tsx:55`, y en `apps/web/src/components/app-shell.tsx:67,77` (Cerrar sesión).

Fix propuesto: agregar una variante de tamaño táctil (p. ej. `size-11` con el ícono visual sin cambiar, `[&_svg]:size-4`) y aplicarla a los botones de acción de fila y a los dos botones "Cerrar sesión"; para "Bloquear/Desbloquear" subir de `size="sm"` a un tamaño con `h-11`. No implica cambiar el diseño visual, solo el área de toque.

### Important

**UX1-02 — Contraste insuficiente en rojo destructivo (texto y chip)**
Pantallas: Login (mensaje de error), Usuarios (chip "Bloqueado") · Viewport: 1280 (aplica a todos)
Evidencia: mensaje de error del login (`role="alert"`, 14 px/400) mide 4.05:1 sobre `--porcelain`; el chip "Bloqueado" (`Badge variant="destructive"`, fondo `bg-destructive/10` sobre tarjeta blanca) mide ≈3.83:1. El mínimo AA para texto normal es 4.5:1.
Causa: `--destructive` en `apps/web/src/index.css:71` = `#d6453d`, igual a `--articulating-red`, demasiado claro para texto pequeño sobre fondos claros. Usado en `apps/web/src/features/auth/login-form.tsx:39,52,56` y `apps/web/src/components/ui/badge.tsx:13-14`.
Fix propuesto: oscurecer el tono usado para texto (p. ej. `#b53a32`) manteniendo `--articulating-red` para superficies grandes/iconos; o añadir un token `--destructive-text` más oscuro y usarlo en `text-destructive` de mensajes de error y en el texto del badge destructivo.

**UX1-03 — La tabla "Productos y precios" exige scroll horizontal interno a 1280 px**
Pantalla: Configuración → Productos · Viewport: 1280
Evidencia: el contenedor `overflow-x-auto` de la tabla mide `scrollWidth: 1004px` vs `clientWidth: 960px` — la columna "Estado" (interruptor activo/inactivo) queda parcialmente oculta y requiere desplazar la tabla, algo inesperado en un escritorio de 1280 px.
Causa: `apps/web/src/features/products/products-table.tsx` define 8 columnas (Código, Producto, Categoría, Se cobra, Precio base, Días, Prueba, Estado) + acciones, más ancho de lo que cabe en el contenido máximo de 1200 px.
Fix propuesto: fusionar "Prueba" como un ícono/tooltip junto a "Días" u ocultarla bajo `xl:` para dejar 7 columnas visibles por defecto.

**UX1-04 — "Precios especiales" no tiene buscador**
Pantalla: Clínica → detalle → Precios especiales · Viewports: 1280, 390
Evidencia: la pestaña lista cada producto del catálogo (60+ filas con los datos de prueba actuales) sin filtro, a diferencia de la lista de Clínicas que sí incluye "Buscar clínica".
Causa: `apps/web/src/features/products/clinic-prices-table.tsx` no incluye un campo de búsqueda.
Fix propuesto: reutilizar el patrón de búsqueda de `clinics-table.tsx` para filtrar por nombre o código de producto.

**UX1-05 — El botón primario de "Laboratorio" no ocupa el ancho completo en móvil**
Pantalla: Configuración → Laboratorio · Viewport: 390
Evidencia: "Guardar cambios" mide 308.8 px de 390 px disponibles (envuelto en `flex justify-end`), mientras que la dirección de diseño exige "los botones primarios ocupan el ancho completo al pie del formulario" en móvil — regla que sí cumplen los diálogos de Usuarios/Clínicas.
Causa: `apps/web/src/features/config/lab-settings-form.tsx:72` — `<div className="flex justify-end">`.
Fix propuesto: `flex flex-col-reverse sm:flex-row sm:justify-end` en el contenedor y `w-full sm:w-auto` en el botón.

**UX1-06 — Dos fases comparten el mismo color, coincidente con el teal primario**
Pantalla: Configuración → Fases · Viewports: 1280, 390
Evidencia: "Empaque" y "Cerámica/Acrílico" tienen ambas `#0F766E`, idéntico a `--teal-lab`, el color reservado para la acción primaria, enlaces activos y el anillo de foco. Esto reduce la utilidad de la "pestaña de color del ticket" como identificador visual entre fases.
Causa: `apps/web/src/features/stages/stage-form.tsx:30` usa `'#0F766E'` como valor por defecto para toda fase nueva, sin validar unicidad.
Fix propuesto: cambiar el color por defecto a uno neutro fuera de la paleta de acento (o dejarlo vacío obligando a elegir) y validar que no se repita entre fases activas.

### Minor

**UX1-07 — Sin paginación en listas largas (Clínicas, Precios especiales)**
Pantallas: Clínicas, Clínica → Precios especiales · Viewports: 1280, 390
Evidencia: 45+ clínicas y 60+ productos se renderizan sin límite (agravado por datos de prueba E2E acumulados, pero sin mecanismo para cuando el catálogo real crezca).
Causa: `apps/web/src/components/data-table.tsx` no pagina.
Fix propuesto: fuera de esta ola por alcance; queda como mejora de backlog (agregar paginación o "cargar más" pasadas ~50 filas).

**UX1-08 — 3 campos de "Laboratorio" sin atributo `autocomplete`**
Pantalla: Configuración → Laboratorio · Viewport: 1280
Evidencia: Chrome DevTools reporta el issue nativo "An element doesn't have an autocomplete attribute (count: 3)".
Causa: `apps/web/src/features/config/lab-settings-form.tsx` no fija `autoComplete` en RUC, Dirección y Teléfonos.
Fix propuesto: `autoComplete="tel"` en Teléfonos, `"street-address"` en Dirección, `"off"` en RUC.

**UX1-09 — Buscador y precio especial sin etiqueta visible persistente**
Pantallas: Clínicas (buscador), Clínica → Precios especiales (input) · Viewport: 390
Evidencia: ambos campos solo muestran placeholder/`aria-label` ("Buscar clínica", "Precio especial de X"), sin `<FieldLabel>` visible como el resto de los formularios de la app.
Causa: `clinics-table.tsx` (buscador) y `products/clinic-prices-table.tsx` (input de precio).
Fix propuesto: bajo impacto — opcionalmente añadir una etiqueta visual compacta o documentar como excepción de patrón de búsqueda.

**UX1-10 — CTA "Nuevo producto" queda visible y sin relación en la pestaña "Categorías"**
Pantalla: Configuración → Productos → Categorías · Viewport: 1280
Evidencia: con la pestaña "Categorías" activa se ven simultáneamente "+ Nuevo producto" (cabecera de página) y "+ Nueva categoría" (propio de la pestaña), confundiendo cuál botón corresponde a la vista actual.
Causa: `apps/web/src/routes/_app/configuracion/productos.tsx` pasa una acción estática a `PageHeader`, no depende de la pestaña activa.
Fix propuesto: mostrar la acción de cabecera según el valor de `Tabs` (ocultar "Nuevo producto" cuando la pestaña activa es "Categorías").

## Aciertos (mantener)

- La pestaña de color del ticket (borde izquierdo 4 px teal) está implementada en la tarjeta de login, tal como pide la dirección de diseño.
- Foco visible consistente: anillo teal de 3 px en inputs, y el diálogo "Nuevo usuario" lleva el foco automáticamente al primer campo.
- Todos los estados (Activo/Bloqueado/Activo-Inactivo) usan chip + texto, nunca solo color.
- El diálogo de confirmación "Bloquear acceso" explica la consecuencia ("La persona no podrá iniciar sesión...") y por defecto enfoca "Cancelar", un patrón seguro.
- Reordenar fases usa botones "Subir"/"Bajar" en vez de arrastrar — accesible por teclado y sin necesidad de soporte táctil fino.
- La conversión tabla→tarjeta en móvil funciona bien y sin scroll horizontal de página en las 8 pantallas recorridas (Usuarios, Clínicas, Doctores, Productos, Fases), incluso a 360 px.
- La barra inferior móvil tiene los 5 destinos con `aria-current="page"` en el activo y cada ícono mide ~78×60 px, muy por encima del mínimo.
- Datos en JetBrains Mono (códigos, correos, montos, colores hex) tal como define la dirección de diseño.
- Copy en español, sentence case y verbos concretos en las 9 pantallas recorridas ("Ingresar", "Nuevo usuario", "Bloquear acceso").
- Los botones primarios de creación (Nuevo usuario/clínica/producto/fase) y los del diálogo modal sí cumplen 44 px y ancho completo en móvil.

## Propuesta de ola de fixes

| # | Commit | Hallazgos | Tamaño | Test que lo cubre |
|---|---|---|---|---|
| 1 | `fix(web): agrandar objetivos táctiles de acciones de fila y cerrar sesión a 44px` | UX1-01 | L | E2E Playwright: `boundingBox().height/width >= 44` sobre Editar/Bloquear/Subir-Bajar en Usuarios, Clínicas y Fases a viewport móvil; test de componente (Vitest + Testing Library) verificando la clase de tamaño en `Button` |
| 2 | `fix(web): oscurecer texto e insignia destructivos para cumplir contraste AA` | UX1-02 | S | Vitest: función utilitaria de contraste sobre el color final de `text-destructive` y `Badge variant="destructive"` (≥4.5:1) |
| 3 | `fix(web): agregar buscador a precios especiales y ajustar columnas de productos` | UX1-03, UX1-04 | M | Vitest de `clinic-prices-table` filtrando por nombre; E2E Playwright verificando `scrollWidth === clientWidth` en la tabla de productos a 1280 |
| 4 | `fix(web): botón "Guardar cambios" a ancho completo en móvil y CTA de productos según pestaña` | UX1-05, UX1-10 | S | E2E Playwright a 390px: ancho del botón ≈ ancho del formulario; test de componente verificando que la acción de cabecera cambia con la pestaña activa |
| 5 | `fix(web): color de fase por defecto fuera de la paleta primaria y validación de unicidad` | UX1-06 | S | Vitest en el schema/form de fases: rechaza guardar dos fases activas con el mismo color; valor por defecto ya no es `#0F766E` |
| 6 | `fix(web): autocomplete en campos de laboratorio y etiqueta visible en buscadores` | UX1-08, UX1-09 | S | Vitest de `LabSettingsForm` verificando `autoComplete` en los 3 campos; snapshot de accesibilidad sin el issue nativo de Chrome DevTools |

UX1-07 (paginación) queda fuera de esta ola por alcance — se registra como mejora de backlog para cuando el catálogo/lista de clínicas reales crezca.
