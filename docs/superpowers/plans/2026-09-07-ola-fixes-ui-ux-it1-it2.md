# Ola de fixes UI/UX — Iteraciones 1 y 2 — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir los hallazgos Critical e Important (y los Minor baratos) de las revisiones UI/UX de la Iteración 1 (#49) y la Iteración 2 (#50) antes de construir la Iteración 3 encima.

**Architecture:** Primero los componentes base (`button`, `select`, `tabs`) para que el tamaño táctil de 44 px sea el valor por defecto en toda la app; después los fixes por pantalla (formulario de trabajo, tablas a 1280 px, diálogos, importación). Cada tarea lleva su prueba (Vitest + Testing Library o Playwright) y verificación en Chrome DevTools; un E2E de accesibilidad barre los tamaños táctiles en móvil.

**Tech Stack:** React 19, Tailwind 4 (variante `pointer-coarse:`), shadcn radix-nova, TanStack Router/Query, Vitest 4 + Testing Library, Playwright 1.62; API Hono + Drizzle.

**Spec:** `docs/superpowers/reviews/2026-09-07-revision-ui-ux-iteracion-1.md` (UX1-NN) y `docs/superpowers/reviews/2026-09-07-revision-ui-ux-iteracion-2.md` (UX2-NN); dirección de diseño `docs/superpowers/specs/2026-09-01-dentalware-design-direction.md`. Issues #49 y #50 (hito Iteración 3). Rama `fix/revision-ui-ux-it1-it2`.

## Global Constraints

- TDD (RED → GREEN → refactor) en cada tarea; código sin test = Important en revisión.
- Objetivo táctil mínimo 44 × 44 px en todo control interactivo (dirección de diseño §accesibilidad); en tablas densas de escritorio se admite 36 px con `pointer-coarse:` → 44 px.
- Contraste AA (≥ 4.5:1 texto normal) para todos los tokens de color de texto e insignias.
- Sin scroll horizontal de página en 1280 / 390 / 360; las tablas de escritorio caben a 1280 px sin scroll interno.
- Español, sentence case; un componente por archivo; rutas solo importan de `features/` y `components/`.
- Verificación por tarea en Chrome DevTools a 1280×800, 390×844 y 360×740 con consola limpia; `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` antes de cada commit; E2E `pnpm e2e --project=escritorio --project=android` al cerrar la tarea que los toque.
- Commits con `Refs #49, #50` y trailers `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` / `Claude-Session: <url>`.

## Rulings del controlador (fuera de esta ola, con motivo)

- **UX2-07** (celdas del odontograma de 41 px a 390 y 37 px a 360): a 360 px no caben 8 celdas de 44 px más separación en un diálogo de 344 px sin romper la disposición por cuadrante (8 piezas por fila) ni añadir scroll horizontal dentro del odontograma, que empeora la usabilidad. Las celdas superan con holgura el mínimo AA de 24 px (WCAG 2.5.8) y el gap evita toques accidentales. Se acepta y se documenta en el informe; se reevaluará si el laboratorio reporta errores de selección en teléfonos pequeños.
- **UX1-07** (paginación en Clínicas y Precios especiales) y **UX2-12** (combobox con buscador para Clínica y Producto): mejoras de producto para cuando el catálogo real crezca; issue de backlog aparte.
- **UX1-06** se resuelve cambiando el color por defecto y los colores del seed; no se añade validación de unicidad de color (una fase repetida de color no es un error de datos).

---

### Task 1: Componentes base a 44 px (Button, Select, Tabs, enlace de plantilla) + E2E de tamaños táctiles (UX1-01, UX2-01, UX2-02, UX2-08, UX2-11)

**Files:**
- Modify: `apps/web/src/components/ui/button.tsx` (escala `size`), `apps/web/src/components/ui/select.tsx` (`data-[size=default]:h-8` → `h-11`), `apps/web/src/components/ui/tabs.tsx` (`TabsList` `h-fit p-1`, `TabsTrigger` `h-11`), `apps/web/src/features/cases/teeth-dialog.tsx` y `odontogram.tsx` (botones del pie y de arcada con la escala nueva), `apps/web/src/features/cases/import-dialog.tsx` (enlace «Descargar plantilla» como `Button asChild variant="link"` de 44 px), el botón «Cerrar sesión» del cascarón (`apps/web/src/components/app-shell*.tsx` o donde viva), y las acciones de fila de Usuarios / Clínicas / Fases (`apps/web/src/features/*/…-table.tsx`) si usan `size="xs"`.
- Test: `apps/web/src/components/ui/button.test.tsx`, `select.test.tsx`, `tabs.test.tsx` (nuevos), `apps/web/e2e/accesibilidad.spec.ts` (nuevo).

**Interfaces:**
- `Button` `size`: `default` → `h-11`; `sm` → `h-9 pointer-coarse:h-11`; `lg` → `h-12`; `icon` → `size-11`; `icon-sm` → `size-9 pointer-coarse:size-11`; `icon-lg` → `size-12`; `xs`/`icon-xs` se mantienen solo para chips no interactivos (grep: no deben usarse en acciones).
- `SelectTrigger`: por defecto `h-11`; `size="sm"` → `h-9 pointer-coarse:h-11`.
- `TabsTrigger`: `min-h-11`; `TabsList`: `h-fit p-1`.
- Helper E2E `expectTouchTargets(page, selector, min = 44)` en `apps/web/e2e/helpers.ts`: comprueba `boundingBox()` de cada elemento visible que coincida.

- [ ] **Step 1: Tests (RED)** — `button.test.tsx`: `render(<Button>Ir</Button>)` tiene clase `h-11`; `size="icon"` tiene `size-11`; `size="sm"` tiene `pointer-coarse:h-11`. `select.test.tsx`: `SelectTrigger` sin `size` no contiene `h-8` y contiene `h-11`. `tabs.test.tsx`: `TabsTrigger` contiene `min-h-11`. `accesibilidad.spec.ts` (proyecto android, `loginAsAdmin`): en `/trabajos`, `/trabajos/nuevo` (con el diálogo de piezas abierto tras elegir un producto por pieza), `/trabajos/<id>` (crear por API), `/configuracion/usuarios`, `/configuracion/clinicas`, `/configuracion/fases` y el diálogo Importar: todo `button, a[href], [role=tab], [role=combobox], input[type=file], [role=switch]` visible mide ≥ 44 px de alto y de ancho (excepto los `role=switch`, solo alto ≥ 24 y ancho ≥ 44 de área táctil: usar el label que lo envuelve). Ejecutar y ver fallar por los 25/28/32 px actuales.
- [ ] **Step 2: Implementación (GREEN)** — cambiar las escalas; eliminar los `h-11` redundantes que las pantallas pasaban a `Button`/`SelectTrigger` (grep `h-11`) solo si el resultado es idéntico; revisar que los diálogos de Configuración (`FormDialog`) y las tablas siguen alineados (el `Input` es `h-9`? → comprobar que `Input`/`Textarea` de formularios también miden ≥ 44 px en móvil: si `input.tsx` tiene `h-8`, aplicar `h-11` igual que Select, añadiendo el caso a `accesibilidad.spec.ts`).
- [ ] **Step 3: Chrome DevTools** — 1280 / 390 / 360: lista de trabajos (pestañas y filtros), nuevo trabajo (selects, diálogo de piezas con pie y botones de arcada), ficha (pestañas), importar (enlace), Configuración → Usuarios y Fases (acciones de fila), cerrar sesión; medir con `getBoundingClientRect`; consola limpia; sin desalineación entre inputs y selects en la misma fila.
- [ ] **Step 4: Verificación y commit** — `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm e2e --project=escritorio --project=android`. Commit: `fix(web): botones, selects y pestañas de 44 px por defecto; E2E de tamaños táctiles` (Refs #49, #50, #28).

### Task 2: Contraste AA del rojo destructivo y colores de fases (UX1-02, UX1-06)

**Files:**
- Modify: `apps/web/src/index.css` (`--destructive` claro/oscuro y, si existe, `--destructive-foreground`), `apps/web/src/components/ui/badge.tsx` (variante `destructive` si usa fondo suave con texto rojo), formulario de fases (`apps/web/src/features/stages/stage-form.tsx`: color por defecto), `apps/api/src/scripts/seed.ts` (colores de fases distintos entre sí y del primario `#0f766e`).
- Test: `apps/web/src/lib/contrast.ts` + `contrast.test.ts` (nuevo: `contrastRatio(hexA, hexB)` según WCAG), `apps/web/src/lib/theme-tokens.test.ts` (lee `index.css`, extrae `--destructive`, `--background`, `--foreground` y afirma ≥ 4.5:1 sobre fondo claro; insignia destructiva ≥ 4.5:1), test del formulario de fases (color por defecto ≠ primario) y test del seed (colores únicos) en `apps/api/src/scripts/seed.test.ts` si existe o unitario de la lista de fases exportada.

- [ ] **Step 1: Tests (RED)** — los tests de contraste fallan con `#d6453d` (~4.05:1) y con el chip actual (~3.83:1); el test de fases falla porque el color por defecto es `#0F766E` y dos fases del seed comparten color.
- [ ] **Step 2: Implementación (GREEN)** — elegir un rojo ≥ 4.5:1 sobre `--background` (p. ej. `#b3261e`) manteniendo la familia; para la insignia, fondo `destructive/10` con texto del nuevo rojo (medir) o texto blanco sobre rojo; color por defecto de fase `#6b7280`-like fuera del teal; seed con 7 colores distintos.
- [ ] **Step 3: Chrome DevTools** — Usuarios (bloquear: texto rojo y chip «Bloqueado»), Fases (chips de color), diálogo de confirmación destructivo; capturas 1280/390.
- [ ] **Step 4: Commit** — `fix(web): rojo destructivo con contraste AA; colores de fases distintos por defecto` (Refs #49).

### Task 3: Formulario de trabajo — Cantidad sincronizada con las piezas, etiquetas en escritorio, h1 y contador de la ficha (UX2-03, UX2-04, UX2-09, UX2-10)

**Files:**
- Modify: `apps/web/src/features/cases/case-items-editor.tsx` (para `por_pieza`: al guardar el diálogo `setValue(items.N.quantity, teeth.length || 1)`, campo Cantidad de solo lectura con ayuda «Según piezas»; fila de encabezados de columna visible en `lg:` o etiquetas siempre visibles), `apps/web/src/features/cases/case-header.tsx` (`<h1>` con el código), `apps/web/src/routes/_app/trabajos/$caseId.tsx` (contador «Historial (N)» = eventos totales).
- Test: `case-form.test.tsx` / `case-items-editor.test.tsx` (nuevo si no existe), `case-header.test.tsx`, test de la ruta o del componente que arma el contador.

- [ ] **Step 1: Tests (RED)** — elegir producto por pieza, guardar piezas 11 y 12 en el diálogo → Cantidad = 2 y total de línea = 2 × precio; producto por arcada → Cantidad editable no cambia; en escritorio (`setMatchMedia` ≥ lg) los encabezados «Producto / Cantidad / Piezas / Precio unitario / Descuento / Material / Nota» son visibles; `getByRole('heading', { level: 1, name: /26-\d{5}/ })` en `CaseHeader`; «Historial (3)» con 3 eventos de los cuales 1 comentario.
- [ ] **Step 2: Implementación (GREEN)**; también al quitar piezas hasta 0 → Cantidad 1.
- [ ] **Step 3: Chrome DevTools** — nuevo trabajo 1280 (encabezados de línea) y 390 (etiquetas), diálogo de piezas → Cantidad cambia, ficha con h1 y contador.
- [ ] **Step 4: Commit** — `fix(web): la cantidad sigue a las piezas marcadas; encabezados de línea en escritorio; h1 y contador de historial en la ficha` (Refs #50).

### Task 4: Tablas y cabeceras a 1280 px y en móvil (UX1-03, UX2-05, UX1-05, UX1-10)

**Files:**
- Modify: `apps/web/src/features/cases/cases-table.tsx` (columnas: código con badge de urgencia como icono con `title`, clínica·doctor compactos, sin columna sobrante; objetivo `scrollWidth === clientWidth` a 1280), `apps/web/src/features/products/products-table.tsx` (columnas compactas / ocultar columna secundaria bajo `xl`), `apps/web/src/features/lab/lab-settings-form.tsx` (botón «Guardar cambios» `w-full sm:w-auto`), `apps/web/src/routes/_app/configuracion/productos.tsx` (CTA de cabecera según pestaña activa: «Nuevo producto» / «Nueva categoría»).
- Test: Vitest de `cases-table` (columnas esperadas y `title` del badge), test de la página de productos (CTA cambia con la pestaña), test de `LabSettingsForm` (clase `w-full`), E2E en `accesibilidad.spec.ts` o `trabajos.spec.ts` proyecto escritorio: contenedor de la tabla de trabajos y de productos con `scrollWidth <= clientWidth` a 1280.

- [ ] **Step 1: Tests (RED)** → **Step 2: GREEN** → **Step 3: Chrome 1280/390** (tablas sin scroll interno, «Estado» y «Total» visibles; botón de Laboratorio a ancho completo en móvil) → **Step 4: Commit** `fix(web): tablas de trabajos y productos caben a 1280 px; botón de laboratorio y CTA de productos coherentes` (Refs #49, #50).

### Task 5: Importación — errores de resolución por fila junto con los de formato (UX2-06)

**Files:**
- Modify: `apps/api/src/features/cases/import.ts` (resolver clínica/doctor/producto para TODAS las filas aunque otras tengan errores de formato; combinar errores por fila; seguir sin crear nada si hay cualquier error), `packages/shared/src/schemas/import.ts` si el tipo de error necesita `kind: 'formato' | 'resolucion'` (opcional; no romper `ImportReport`).
- Test: `apps/api/src/features/cases/import.test.ts` — CSV con fila 2 solo con clínica inexistente y fila 3 con fecha inválida → la respuesta trae ambos errores (fila 2 columna clinica, fila 3 columna fecha_deseada) en una sola validación; con `confirmar=true` no crea nada.

- [ ] **Step 1: Tests (RED)** → **Step 2: GREEN** (resolver por fila cuando la fila tiene los campos de nombre válidos aunque falle otra columna) → **Step 3: Chrome** (Importar con el CSV de dos filas: tabla muestra los dos errores) → **Step 4: Commit** `fix(api): la validación de importación reporta errores de formato y de resolución en la misma pasada` (Refs #50).

### Task 6: Precios especiales con buscador, etiquetas visibles y autocomplete (UX1-04, UX1-08, UX1-09)

**Files:**
- Modify: `apps/web/src/features/clinics/clinic-prices-table.tsx` (o donde viva la tabla de precios especiales: input de búsqueda por código/nombre de producto con etiqueta visible), buscadores de Clínicas/Usuarios/Trabajos (etiqueta visible o `aria-label` + `placeholder` coherente; el informe pide etiqueta persistente: usar `FieldLabel` visible en móvil y `sr-only`+`placeholder` en escritorio solo si el diseño lo justifica), `apps/web/src/features/lab/lab-settings-form.tsx` (`autoComplete` en nombre, teléfono, correo/dirección).
- Test: Vitest de la tabla de precios (filtra por «zir» → solo Zirconio), de `LabSettingsForm` (`autoComplete` presente), y de los buscadores (`getByLabelText('Buscar…')`).

- [ ] **Step 1: Tests (RED)** → **Step 2: GREEN** → **Step 3: Chrome** (detalle de clínica con 50 productos: buscar; Laboratorio en móvil: teclado sugiere autocompletado) → **Step 4: Commit** `fix(web): buscador en precios especiales, etiquetas visibles en buscadores y autocomplete en laboratorio` (Refs #49).

### Task 7: Cierre — informes actualizados, issues y PR

- [ ] Añadir a cada informe una sección «Resultado de la ola de fixes» (hallazgo → commit / diferido con motivo); crear issue de backlog «Paginación en Clínicas y Precios especiales; combobox con buscador para Clínica y Producto» (UX1-07, UX2-12) y anotar UX2-07 como aceptado.
- [ ] `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm e2e --project=escritorio --project=android`; recorrido final en Chrome (1280 / 390 / 360) de lista, nuevo trabajo, ficha, importar y Configuración.
- [ ] Commit `docs: resultado de la ola de fixes UI/UX de las iteraciones 1 y 2`; PR contra `main` que cierra #49 y #50 (y #28 si Task 1 lo cubre); tablero: #49/#50 → En revisión.
