# DataGrid estándar sobre TanStack Table v9 — diseño

Issue #53 (tarea de la Iteración 3). Decidido con Nelson el 2026-09-12 tras brainstorming. Complementa `docs/architecture.md` §3.3 (web hexagonal-lite) y la dirección de diseño (`2026-09-01-dentalware-design-direction.md`).

## 1. Objetivo y alcance

Sustituir `apps/web/src/components/data-table.tsx` por un `DataGrid` **modular y plug and play** sobre **TanStack Table v9** (estable, 9.2.4): cada capacidad (paginación, orden, filtros por columna, filtro avanzado, agrupación, redimensionado, columnas fijadas, estado en URL) vive en su propio módulo, se activa añadiéndola a una lista y se desactiva quitándola, sin tocar el núcleo ni las demás. Las 7 tablas actuales migran en este trabajo; las de las iteraciones 3–5 nacen ya sobre `DataGrid`.

**Decisiones tomadas**

| Tema | Decisión | Motivo |
|---|---|---|
| Motor | TanStack Table v9 (`tableFeatures()` + `useTable`) | v9 ya es estable y su registro de features es exactamente la arquitectura pedida; solo se empaqueta lo que se usa |
| UI | Headless + partes propias sobre nuestras primitivas shadcn; copia selectiva de la guía oficial de shadcn (v9) y de ReUI Data Grid (celda de cabecera, asa de redimensionado, CSS de columnas fijadas) | mantiene 44 px, español, tarjetas móviles y pestaña de color; evita heredar TanStack Virtual o un tema ajeno. AG Grid, MUI X, Material/Mantine React Table descartados (tema incompatible, peso, sin tarjetas) |
| Orden en el servidor | `caseListQuerySchema` gana `orden` | la lista de trabajos pagina y filtra en la API; sin este parámetro el orden por columna no sería real |
| Consumidores | cada capacidad nace con al menos una tabla real que la usa (§5) | demuestra el plug and play y evita ruido en tablas pequeñas |
| Estado persistido | solo anchos y columnas fijadas, en `localStorage` bajo `datagrid:<key>` | lo demás vive en la URL o es efímero |

**Fuera de alcance**: virtualización (tablas de decenas o cientos de filas), edición en celda, selección de filas, exportación, arrastrar columnas o filas, filtro avanzado sobre tablas en modo servidor (la API no admite condiciones arbitrarias en el MVP).

## 2. Arquitectura

```
apps/web/src/components/data-grid/
  index.ts               exporta DataGrid, useDataGrid, defineColumns y las factorías de features
  data-grid.tsx          DataGrid.Root (provider) y composición de subcomponentes
  use-data-grid.ts       compone tableFeatures() y useTable a partir de la lista de features
  context.ts             contexto interno: table, features registradas, key, modo
  define-columns.ts      createColumnHelper tipado + meta propio (filter, mobile, align, width)
  types.ts               GridFeature, GridColumnMeta, GridMode, GridSlots
  features/
    pagination.ts        cliente o servidor; tamaño de página; conteo aria-live
    sorting.ts           por columna, multi opcional; aria-sort; cliente o servidor
    filtering.ts         por columna: text | select (faceted) | range
    advanced-filter.ts   constructor columna · operador · valor con AND/OR; solo cliente
    grouping.ts          agrupar por columna, filas de grupo expandibles, agregados
    resizing.ts          anchos por columna con persistencia por key
    pinning.ts           fijar a izquierda/derecha; sticky; scroll interno
    url-state.ts         porciones de estado controladas desde la ruta (TanStack Router)
  parts/
    toolbar.tsx          monta los slots `toolbar` de las features registradas
    table.tsx            <table> con cabecera, cuerpo, filas de grupo, columnas fijadas
    header-cell.tsx      texto, botón de orden, asa de redimensionado, menú de columna
    column-menu.tsx      fijar, ocultar, agrupar por (solo si la feature existe)
    cards.tsx            variante móvil generada desde meta.mobile o renderCard
    pagination.tsx       Anterior / Siguiente, página actual, tamaño
    empty.tsx            EmptyState con acción
  storage.ts             lectura/escritura segura de localStorage (try/catch)
```

Un componente o hook por archivo (regla 3 de `CLAUDE.md`). `DataGrid` es transversal: vive en `components/`, nunca en una feature.

### 2.1 Contrato de una feature (`types.ts`)

```ts
export type GridFeature = {
  id: 'pagination' | 'sorting' | 'filtering' | 'advancedFilter' | 'grouping' | 'resizing' | 'pinning' | 'urlState'
  /** Features, row models y fns de TanStack que este módulo necesita; se fusionan en tableFeatures(). */
  tanstack: Record<string, unknown>
  /** Opciones de TableOptions que aporta (manualSorting, enableColumnPinning, autoResetPageIndex…). */
  options?: (ctx: GridContextInit) => Record<string, unknown>
  /** Estado inicial que siembra (initialState) y, en modo controlado, cómo leerlo/escribirlo. */
  state?: GridStateBinding
  /** Componentes que aporta a cada zona; DataGrid los monta solo si la feature está registrada. */
  slots?: {
    toolbar?: ComponentType
    headerCell?: ComponentType<{ header: Header }>
    columnMenu?: ComponentType<{ column: Column }>
    footer?: ComponentType
    row?: ComponentType<{ row: Row }> // filas de grupo
  }
}
```

Cada módulo de `features/` exporta una factoría con opciones tipadas, por ejemplo `pagination({ pageSize: 25 })`, `sorting({ multi: false })`, `pinning({ left: ['code'] })`, `urlState({ search, navigate, keys: { pagina: 'pagination', orden: 'sorting', q: 'globalFilter' } })`. La factoría devuelve un `GridFeature`.

`useDataGrid({ key, columns, data, features, mode, rowCount?, getRowId })`:

1. Reduce `features[].tanstack` en un solo objeto y llama a `tableFeatures(...)` una vez (memoizado por identidad de la lista).
2. Reduce `features[].options(ctx)` en `TableOptions`; en `mode: 'server'` añade `manualPagination/manualSorting/manualFiltering` y `rowCount`.
3. Reduce `features[].state` en `initialState` o en `state` + `on*Change` cuando hay `urlState`.
4. Llama a `useTable(options, selector)` con un selector que solo proyecta las porciones de estado de las features registradas.
5. Devuelve `{ table, features, key, mode }` que `DataGrid.Root` pone en contexto.

Regla de aislamiento: `use-data-grid.ts`, `data-grid.tsx` y `parts/*` **no importan** ningún archivo de `features/`; solo conocen el contrato `GridFeature` y leen del contexto qué ids hay registrados. Una feature puede importar `types.ts`, `context.ts` y primitivas de `components/ui/`, nunca otra feature. Esto se verifica con un test que monta el grid con cada feature aislada y con ninguna.

### 2.2 Definición de columnas (`define-columns.ts`)

```ts
const columns = defineColumns<Clinic>((col) => [
  col.accessor('name', { header: 'Nombre', meta: { mobile: 'title', filter: 'text' } }),
  col.accessor('city', { header: 'Ciudad', meta: { mobile: 'subtitle', filter: 'select' } }),
  col.accessor('active', { header: 'Estado', cell: (c) => <ActiveBadge active={c.getValue()} />, meta: { mobile: 'detail' } }),
  col.display({ id: 'actions', header: '', cell: ActionsCell, meta: { mobile: 'actions', align: 'right' } }),
])
```

`GridColumnMeta` (tipado con `metaHelper<GridColumnMeta>()` en `tableFeatures`): `filter?: 'text' | 'select' | 'range'`, `mobile?: 'title' | 'subtitle' | 'detail' | 'actions' | 'hidden'`, `align?: 'left' | 'right'`, `width?: number`, `cellClassName?`, `cellStyle?: (row) => CSSProperties` (pestaña de color del ticket), `aggregate?: 'sum' | 'count'` (para agrupación), `sortKey?: string` (nombre del campo de orden en la API en modo servidor).

La misma definición sirve para la tabla y para las tarjetas: `parts/cards.tsx` toma `title`, `subtitle`, `detail` y `actions` de `meta.mobile`. `renderCard(row)` sigue disponible para diseños propios (trabajos).

### 2.3 Estado

| Porción | Interno (defecto) | Controlado por URL (`urlState`) | Persistido (`key`) |
|---|---|---|---|
| paginación | sí | `pagina` | — |
| orden | sí | `orden` (`campo` o `campo-desc`) | — |
| filtros por columna / búsqueda | sí | claves declaradas (`q`, `clinicId`, `estado`…) | — |
| filtro avanzado | sí | serializado `f=` (JSON compacto) opcional | — |
| agrupación / expandido | sí | — | — |
| anchos | sí | — | `datagrid:<key>:sizing` |
| fijadas | sí | — | `datagrid:<key>:pinning` |

`urlState` recibe `search` y `navigate` de la ruta y un mapa de claves; convierte entre el estado de TanStack y los parámetros de búsqueda, y **resetea `pagina`** al cambiar orden o filtros (comportamiento actual de `updateSearch`). La validación de la URL sigue en `validateSearch` de la ruta con los schemas de shared: el grid no valida.

`storage.ts` envuelve `localStorage` en try/catch con valor por defecto; una versión por clave (`v1`) para poder invalidar.

### 2.4 Modo servidor

`mode: 'server'` se declara por tabla. El grid **nunca llama a la API**: emite cambios de paginación, orden y filtros a la ruta (vía `urlState` o `onStateChange`), la ruta arma la query de TanStack Query como hoy (`useCases(query)`) y devuelve `data` + `rowCount`. Respeta la frontera de `api.ts` (`docs/architecture.md` §3.3) y el lint de fronteras.

### 2.5 Cambio en la API de trabajos (`orden`)

`packages/shared/src/schemas/cases.ts`: `orden: z.enum(['codigo', 'codigo-desc', 'entrega', 'entrega-desc', 'clinica', 'clinica-desc', 'estado', 'estado-desc']).optional()`. Sin `orden`, el repo conserva el orden actual (urgentes primero, código descendente). Con `orden`, el repo aplica `orderBy(desc(urgente), <campo> asc|desc, code desc)` como desempate. Tests: shared (parseo), API (cada campo y dirección; técnico también puede ordenar), web (mapa `sorting` ↔ `orden`).

## 3. Features

| Feature | TanStack v9 | Estado y UI | Notas |
|---|---|---|---|
| `pagination` | `rowPaginationFeature`, `createPaginatedRowModel()` (cliente) | `parts/pagination.tsx`: Anterior/Siguiente (44 px), «Página N de M», conteo `aria-live`; tamaño por defecto 25 | servidor: `manualPagination` + `rowCount`; `autoResetPageIndex` solo en cliente |
| `sorting` | `rowSortingFeature`, `createSortedRowModel()`, `sortFns` | botón en cabecera con `aria-sort`, icono; `Enter`/`Space`; multi con `Shift` solo si `multi: true` | servidor: `manualSorting`; `meta.sortKey` mapea a `orden` |
| `filtering` | `columnFilteringFeature`, `columnFacetingFeature`, `createFilteredRowModel()`, `createFacetedRowModel()`, `createFacetedUniqueValues()`, `createFacetedMinMaxValues()`, `filterFns` | buscador global (`Input` con `<label>` visible, UX1-09) + control por columna según `meta.filter`; conteo de resultados | insensible a acentos y mayúsculas (mismo `normalize` de clínicas); servidor: `manualFiltering` |
| `advancedFilter` | reutiliza `columnFilteringFeature` con un `filterFn` propio `advanced` | botón «Filtro avanzado» en toolbar → diálogo con filas columna · operador · valor y conmutador AND/OR; chips con las condiciones activas | solo `mode: 'client'`; operadores por tipo: texto (contiene, es, empieza), número/fecha (=, ≠, >, <, entre), select (es, no es) |
| `grouping` | `columnGroupingFeature`, `rowExpandingFeature`, `rowAggregationFeature`, `createGroupedRowModel()`, `createExpandedRowModel()`, `aggregationFns` | «Agrupar por» en toolbar (columnas con `meta.groupable`); fila de grupo con botón expandir, nombre y conteo; celdas agregadas según `meta.aggregate` | expandido por defecto; en móvil las tarjetas se separan por encabezado de grupo |
| `resizing` | `columnSizingFeature`, `columnResizingFeature` | asa en cabecera (mouse, touch y teclado con flechas); doble clic restablece | persiste en `datagrid:<key>:sizing`; `onEnd` para no reescribir en cada píxel |
| `pinning` | `columnPinningFeature` | menú de columna «Fijar a la izquierda / derecha / soltar»; `position: sticky` con sombra de borde; scroll horizontal solo del contenedor | persiste en `datagrid:<key>:pinning`; `pinning({ left: ['code'] })` como valor inicial |
| `urlState` | — (solo enlaza estado) | — | requiere `search` + `navigate`; sin él, todo es interno |

Cada feature aporta sus textos en español dentro de su módulo. Ninguna feature depende de otra: cada módulo trae completas las features de TanStack que necesita, y `tableFeatures()` deduplica las repetidas (p. ej. `columnFilteringFeature` en `filtering` y `advancedFilter`).

## 4. Presentación y accesibilidad

- Escritorio (`≥ lg`): `parts/table.tsx` con `Table` de shadcn; contenedor `overflow-x-auto` con `min-w-0`; cabecera con `HeaderCell`; filas de grupo con `aria-expanded`; celdas con `meta.align`, `cellClassName`, `cellStyle`.
- Móvil (`< lg`): `parts/cards.tsx`, una variante montada a la vez (`useMediaQuery`, como hoy). Orden y filtros disponibles desde la toolbar con controles de 44 px; agrupación como encabezados entre tarjetas.
- Toolbar: solo aparecen los controles de las features registradas. Orden fijo: búsqueda · filtros por columna · filtro avanzado · agrupar por · columnas.
- Accesibilidad: `aria-sort` en cabeceras, botones con nombre accesible, foco visible, teclado en menús y en el asa de redimensionado, `aria-live="polite"` en el conteo, contraste AA con los tokens del tema, 44 px por defecto y `sm` solo en acciones de fila de escritorio con `pointer-coarse:` a 44 (convención §5). Los identificadores de fila (código, nombre) conservan `data-target-size="inline"`.
- Dirección de diseño: antes de escribir `parts/*` se pasa por `frontend-design` con la dirección vigente; referencia visual: guía de Data Table de shadcn (v9) y ReUI Data Grid, copiando solo cabecera, asa y CSS de sticky.
- Verificación en Chrome DevTools a 1280×800, 390×844 y 360×740 en cada tabla migrada; sin scroll horizontal de página; consola limpia.

## 5. Migración por tabla

| Tabla | Modo | Features | Conserva |
|---|---|---|---|
| `clinics-table` | cliente | pagination, sorting, filtering (buscador con label visible) | tests UX1-09 y búsqueda sin acentos |
| `doctors-table` | cliente | pagination, sorting, filtering | — |
| `users-table` | cliente | pagination, sorting, filtering | — |
| `stages-table` | cliente | ninguna de orden (orden manual con Subir/Bajar, sin drag) | acciones de fila y switches de 44 px |
| `products-table` | cliente | pagination, sorting, filtering (categoría como `select`, estado), advancedFilter, grouping (por categoría, conteo), resizing | icono «Requiere prueba» (UX1-03) |
| `clinic-prices-table` | cliente | pagination, sorting, filtering (buscador) | borradores por producto que sobreviven al filtro y no cruzan de clínica |
| `cases-table` | **servidor** | pagination, sorting (`orden`), filtering (los de `CasesFilters`, en URL), pinning (`code` a la izquierda), urlState | vistas rápidas, `renderCard` propio con pestaña de color, columna Total oculta a técnico/mensajero, iconos accesibles |

Orden de ejecución: núcleo + `pagination` + `sorting` + `filtering` → clínicas, doctores, usuarios → fases → `grouping` + `advancedFilter` + `resizing` → productos → precios especiales → `pinning` + `urlState` + `orden` en API → trabajos → borrar `data-table.tsx` y su test → docs. Cada tabla se migra en su propia tarea con sus tests existentes en verde sin cambios de comportamiento.

`#56` (paginación en Clínicas y Precios especiales; combobox con buscador) queda cubierto en su parte de paginación por esta migración; el combobox con buscador de los selects de Clínica/Producto sigue siendo tarea aparte.

## 6. Pruebas (TDD)

- **Por feature**: test de Vitest + Testing Library que monta `DataGrid` con la feature sola (comportamiento visible: ordena, pagina, filtra, agrupa, fija, redimensiona) y otro que la monta sin ella (el control no existe en el DOM). Test de aislamiento: `useDataGrid` con `features: []` renderiza tabla y tarjetas sin controles.
- **`define-columns`**: meta tipado, tarjetas generadas desde `meta.mobile`, `cellStyle` aplicado.
- **`urlState`**: mapa estado ↔ search en ambas direcciones; cambiar orden o filtro resetea `pagina`.
- **`storage`**: lectura con `localStorage` roto no lanza; escritura solo al terminar de redimensionar.
- **Tablas migradas**: sus tests actuales pasan sin cambios (regresión); se añade un test por feature activada en esa tabla.
- **API**: `orden` en `cases.test.ts` y en `service.test.ts` (paso del parámetro al repo).
- **E2E** (`@clave`): trabajos ordenados por entrega con `orden` en la URL y columna Código fija con scroll; productos agrupados por categoría con filtro avanzado. `accesibilidad.spec.ts` (`@extendida`) suma la toolbar y el menú de columna en móvil.

## 7. Documentación y reglas

- `docs/data-grid.md`: cómo declarar columnas, activar features, modo servidor, `urlState`, persistencia, tarjetas móviles; ejemplo mínimo y ejemplo de trabajos.
- `CLAUDE.md` regla 3 y `docs/conventions.md` §5: **toda tabla nueva usa `DataGrid`** y declara explícitamente sus features; `data-table.tsx` desaparece.
- `docs/architecture.md` §3.3 (componentes) y ADR 15 pasa a «vigente» con la decisión de v9 y UI propia.
- `pnpm-workspace.yaml`: `@tanstack/react-table: 9.2.4` en el catálogo.

## 8. Criterios de aceptación (del issue #53, precisados)

- Ninguna tabla importa `data-table.tsx`; cada una lista sus features en su archivo.
- Activar o desactivar una feature no requiere tocar `use-data-grid.ts`, `data-grid.tsx`, `parts/*` ni otra feature (test de aislamiento + revisión).
- La lista de trabajos mantiene vistas rápidas, filtros y paginación en la URL y gana orden por columna real (servidor) con `orden` en la URL; E2E existentes en verde.
- Sin scroll horizontal de página en 1280/390/360; `accesibilidad.spec.ts` en verde; consola limpia.
- Verificación completa (`build`, `lint`, `format:check`, `typecheck`, `test`) y E2E `@esencial|@clave` en verde en el PR; suite completa en `main`.

## 9. Riesgos y mitigaciones

- **API de v9 reciente**: cada uso de una API de TanStack se confirma con context7 en la tarea que la introduce; las factorías de `features/` encapsulan los nombres de v9, así que un cambio de la librería toca un archivo.
- **Sticky + tabla + Tailwind**: el CSS de columnas fijadas se prueba en Chrome a 1280 con scroll interno antes de migrar trabajos.
- **Tamaño del PR**: un PR por bloque (núcleo + tablas de configuración; productos y precios; trabajos + API + docs) para mantener revisiones acotadas, todos `Refs #53` y el último `Closes #53`.
