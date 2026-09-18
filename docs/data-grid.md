# DataGrid — guía de uso

Componente transversal en `apps/web/src/components/data-grid/` que **sustituyó por completo** a
`data-table.tsx` (borrado en la Tarea 19, `apps/web/src/components/data-table.tsx` ya no existe en
el repo). Construido sobre `@tanstack/react-table` 9.2.4 (`tableFeatures()` + `useTable`).
Complementa `docs/architecture.md` §3.3 (web hexagonal-lite) y es la implementación de la spec de
diseño `docs/superpowers/specs/2026-09-12-data-grid-design.md` — este documento describe **lo que
existe hoy**: el núcleo y las ocho features `pagination`, `sorting`, `filtering`, `advancedFilter`,
`grouping`, `resizing`, `pinning` y `urlState`. Las 7 tablas del MVP anteriores a `DataGrid`
(`clinics-table.tsx`, `doctors-table.tsx`, `users-table.tsx`, `stages-table.tsx`,
`products-table.tsx`, `clinic-prices-table.tsx`, `cases-table.tsx`) ya corren sobre él; ver «Qué
tabla usa qué feature» más abajo. `apps/web/src/features/cases/case-items-editor.tsx` **no** es
una migración pendiente: es el editor de líneas de un formulario (cantidad, piezas FDI, precio por
línea dentro de `case-form.tsx`), no un listado con orden/filtro/paginación, y sigue con su propia
maquetación en `grid` de CSS — fuera del alcance de `DataGrid`.

## Qué es y cuándo usarlo

Un grid modular y "plug and play": cada capacidad (orden, paginación, filtros…) vive en su propio
módulo de `features/` y se activa añadiéndolo a un array; sin esa entrada, la capacidad no existe
en runtime. Úsalo para cualquier listado tabular, nuevo o existente: clínicas, doctores, usuarios,
fases, productos, precios especiales y trabajos ya corren sobre él (ver «Qué tabla usa qué
feature» más abajo); cuentas y pagos (Iteración 5) y notificaciones (Iteración 6) nacerán ya sobre
`DataGrid`. No lo uses para listas simples que no necesitan orden, filtro ni paginación (una lista
de tres elementos en un `<Select>`, por ejemplo) — ahí un `<ul>` o `<table>` a mano sigue siendo más
simple.

Una sola definición de columnas sirve para la tabla de escritorio y para las tarjetas móviles:
`DataGrid.Content` decide qué variante montar según el ancho de pantalla (`useMediaQuery`, punto
de corte `lg` = 1024 px, una sola variante montada a la vez).

## Definir columnas

`defineColumns<T>(build)` envuelve `createColumnHelper` de TanStack ya tipado con `GridFeatures`
(el conjunto de features que el núcleo conoce) y con el `meta` propio del grid:

```ts
const columns = defineColumns<Clinic>((col) => [
  col.accessor('name', {
    header: 'Clínica',
    meta: { mobile: 'title' },
    cell: (c) => <Link to="...">{c.getValue()}</Link>,
  }),
  col.accessor('city', {
    header: 'Ciudad',
    cell: (c) => c.getValue() ?? '—',
    meta: { mobile: 'subtitle' },
    enableGlobalFilter: false,
  }),
  col.display({
    id: 'actions',
    header: '',
    meta: { mobile: 'actions', align: 'right' },
    cell: (c) => <ActionsCell clinic={c.row.original} />,
  }),
])
```

`col.accessor` lee un campo del dato; `col.display` define una columna sin campo propio (acciones,
un índice calculado). `GridColumnMeta` (`apps/web/src/components/data-grid/types.ts`) admite:

- **`mobile`**: papel de la columna en la tarjeta móvil automática — `'title' | 'subtitle' |
  'badge' | 'detail' | 'actions' | 'hidden'`. Sin valor, la columna se trata como `'detail'`.
- **`filter`**: activa un control en la toolbar de la feature `filtering` — `'text' | 'select' |
  'range'` (ver «Features disponibles»); también decide los operadores que ofrece `advancedFilter`
  sobre esa columna.
- **`groupable`**: `true` para que la columna aparezca en el «Agrupar por» de la feature `grouping`
  y en el item de menú «Agrupar por <columna>» (ver «Features disponibles»).
- **`aggregate`**: `'sum' | 'count'`, agregación que muestra `grouping` para esa columna en la fila
  de grupo (ver «Features disponibles»).
- **`align`**: `'left' | 'right'`; alinea la celda y su cabecera a la derecha (columnas numéricas o
  de acciones).
- **`width`**: ancho inicial en px, traducido a `size` de columna en `useDataGrid` (no en
  `defineColumns`). Sin la feature `resizing`, ese `size` no tiene efecto sobre el ancho de la
  columna (la tabla no aplica ancho por `<th>`/`<td>` salvo con `cellClassName`); con `pinning` sí
  se usa, aunque no haya `resizing`, para el desplazamiento sticky (ver la feature `pinning`). Con
  `resizing` es el ancho de partida antes de que el usuario redimensione (y, si ya redimensionó,
  gana lo guardado en `localStorage`).
- **`cellClassName`**: clases Tailwind adicionales para la celda y la cabecera (por ejemplo un
  ancho fijo con `w-12`).
- **`cellStyle`**: `(row: unknown) => CSSProperties | undefined`, estilo inline por fila —
  pensado para la pestaña de color de un ticket. `row` llega sin tipar (es `row.original` de una
  tabla genérica): castea dentro de la función a tu tipo de fila.
- **`label`**: etiqueta a usar en menús y filtros cuando `header` no es una cadena (por ejemplo un
  nodo JSX). `columnLabel()` cae a `meta.label` → `header` si es texto → `column.id`.

`enableGlobalFilter: false` (opción estándar de TanStack, no de `meta`) excluye una columna del
buscador global de la feature `filtering` — típico en columnas ya cubiertas por un filtro de
columna, o en columnas que no aportan al texto de búsqueda (un código de color, un badge).

## Montar un grid

```tsx
const grid = useDataGrid({
  key: 'clinicas',
  columns,
  data: clinics,
  features: FEATURES,
  getRowId: (c) => c.id,
})

return (
  <DataGrid.Root
    grid={grid}
    emptyMessage={(q) => (q ? `Ninguna clínica coincide con "${q}"` : 'Aún no hay clínicas.')}
    emptyAction={emptyAction}
  >
    <DataGrid.Toolbar />
    <DataGrid.Content />
    <DataGrid.Pagination />
  </DataGrid.Root>
)
```

`useDataGrid({ key, columns, data, features, mode?, rowCount?, getRowId })`:

- **`key`**: identificador estable de la tabla; nombra la persistencia en `localStorage`
  (`datagrid:<key>:<slice>`, por ejemplo `datagrid:productos:sizing`). El helper vive en
  `storage.ts` (`readStored`/`writeStored`, `localStorage` envuelto en try/catch con valor por
  defecto y una versión por clave, `:v1`); `resizing` lo usa para el ancho de columna y `pinning`
  para las columnas fijadas (`datagrid:<key>:pinning`), sin escribirlo de nuevo.
- **`features`**: la lista de módulos activos, en el orden en que se registran (mismo orden en que
  aparecen sus controles en la toolbar y sus slots de cabecera). Decláralo como constante de
  módulo o memorizado con `useMemo`/`useCallback` en el componente si depende de props — la lista
  se usa como dependencia de un `useMemo` interno, así que una referencia nueva en cada render
  recalcula `tableFeatures()` de más.
- **`mode`**: `'client'` (por defecto) o `'server'` — ver «Modo servidor».
- **`rowCount`**: total de filas cuando `mode: 'server'`; se usa para calcular el número de
  páginas y el conteo de la paginación.
- **`getRowId`**: función que da el id estable de una fila (normalmente el id de negocio, no el
  índice del array).

`DataGrid` es un compound component:

- **`DataGrid.Root`**: provee el contexto (`grid`) y las props compartidas (`emptyMessage`,
  `emptyAction`, `renderCard`) a sus hijos. Todo lo demás debe montarse dentro.
- **`DataGrid.Toolbar`**: monta, en el orden de registro de las features, los componentes que cada
  una aporta a `slots.toolbar` — hoy `filtering` (buscador + filtros de columna), `sorting`
  (orden en móvil, ver más abajo), `grouping` («Agrupar por») y `advancedFilter` (botón + chips);
  `pagination`, `resizing`, `pinning` y `urlState` no tienen UI de toolbar. Si ninguna feature
  registrada tiene `toolbar`, no renderiza nada (`parts/toolbar.tsx`).
  - `role="search"` en el contenedor solo cuando `filtering` está registrada (es la única cuya
    toolbar es un formulario de búsqueda).
  - Bajo `lg` (`< 1024 px`), los controles se pliegan dentro de un `<details>`/`<summary>`
    «Filtros y orden» (con un contador de controles activos) **solo cuando 3 o más features
    registradas aportan un slot `toolbar`** — con 1 o 2 (el caso normal: `filtering` + `sorting`
    en clínicas/doctores/usuarios/precios especiales) la barra se ve siempre plana, porque plegar
    solo escondería el buscador que recepción usa a diario sin ahorrar espacio real; con 4 a la
    vez (`sorting` + `filtering` + `grouping` + `advancedFilter`, caso de productos) apilaba nueve
    controles antes de la primera tarjeta. El umbral se cuenta desde `grid.features`, sin conocer
    ninguna feature en concreto.
  - El único slot de `sorting` (`MobileSortControls`, dos `<select>` «Ordenar por»/«Dirección») se
    oculta a sí mismo con `lg:hidden` porque en escritorio el orden se acciona desde el botón de
    cada cabecera (`slots.headerCell`), no desde la toolbar. Si esa es la **única** feature con
    slot de una tabla (hoy solo `cases-table.tsx`), `GridToolbar` queda con un contenedor vacío en
    escritorio; esa tabla envuelve `<DataGrid.Toolbar />` en un `<div className="lg:hidden">`
    propio (comentario junto al JSX en `cases-table.tsx`) en vez de generalizar el núcleo para un
    único caso — decisión de la Tarea 19 (minor M-1 de la revisión de la Tarea 18).
- **`DataGrid.Content`**: la tabla (`≥ lg`) o las tarjetas (`< lg`); si no hay filas, un
  `EmptyState` con `emptyMessage` y, si no hay búsqueda activa, `emptyAction`.
- **`DataGrid.Pagination`**: la barra Anterior/Siguiente. No renderiza nada si `pagination` no
  está entre las features registradas (`grid.has('pagination')`).

`emptyMessage` es un string fijo o una función `(query: string) => string`: cuando la feature
`filtering` está activa y hay texto de búsqueda, `DataGrid.Content` le pasa la búsqueda recortada;
si no hay búsqueda (o `filtering` no está registrada), pasa `''`. Úsalo para distinguir "no hay
resultados para tu búsqueda" de "todavía no hay ninguno" (y en el segundo caso, ofrecer
`emptyAction` — normalmente el botón de crear el primero).

`renderCard(row: T)` reemplaza la tarjeta automática por una a medida (ver «Tarjetas móviles»).

## Features disponibles

Cada feature es una factoría que devuelve un `GridFeature`; se importan desde
`@/components/data-grid` y se listan en el array de `features`:

- **`sorting({ multi?: boolean })`**: orden por columna, cliente o servidor. Aporta un botón por
  cabecera (`slots.headerCell`) con `aria-label="Ordenar por <columna>"` y `aria-sort` en el
  `<th>` (`ascending`/`descending`/ausente). `multi` (por defecto `false`) habilita ordenar por
  varias columnas con Shift+clic (`enableMultiSort`). También aporta un `slots.toolbar` con dos
  `<select>` nativos de 44 px, «Ordenar por» y «Dirección» (spec §4: el orden debe poder
  accionarse desde la toolbar en `< lg`, donde la cabecera con el botón de orden no existe). El
  control está siempre en el DOM — se oculta en escritorio solo con la clase `lg:hidden`, no
  condicionado por `useMediaQuery` — para que sea accionable con teclado y sencillo de probar.
- **`pagination({ pageSize?: number })`**: paginación cliente o servidor; tamaño de página por
  defecto 25 (`DEFAULT_PAGE_SIZE`). Su UI vive en `DataGrid.Pagination`, no en la toolbar: botones
  «Anterior»/«Siguiente» de 44 px, «Página N de M» y un conteo `aria-live="polite"` («Mostrando X
  a Y de Z») visualmente oculto (`sr-only`) pero expuesto a lectores de pantalla.
- **`filtering({ search?: { id, label, placeholder? }, columns?: boolean })`**: buscador global y
  filtros por columna.
  - `search` añade un `<Input type="search">` con `<Label>` visible (id, label y placeholder
    propios por tabla — necesarios para que dos grids en la misma página no choquen de id).
  - `columns: true` añade, junto al buscador, un control por cada columna con `meta.filter`
    definido: `'text'` (input libre), `'select'` (un `<select>` nativo con los valores únicos de
    la columna vía faceted values, filtrando vacíos) o `'range'` (dos inputs numéricos mín/máx).
  - El filtro de texto y el global son insensibles a acentos y mayúsculas (`normalize`); el filtro
    por defecto de cualquier columna sin `meta.filter` explícito sigue siendo ese mismo filtro de
    texto si el usuario le pasa un valor por otra vía.

- **`resizing()`**: anchos de columna redimensionables, cliente o servidor. Aporta un asa por
  cabecera (`slots.headerCell`, `role="separator"`, `aria-orientation="vertical"`,
  `aria-label="Redimensionar <columna>"`) que se arrastra con el ratón o el dedo
  (`columnResizeMode: 'onEnd'`: el ancho se confirma al soltar), se ajusta con el teclado (← → de
  16 px, con foco en el asa) y se restablece con doble clic. El ancho de cada columna se guarda en
  `localStorage` (`datagrid:<key>:sizing`) al terminar de redimensionar y se restaura al montar;
  `meta.width` es el ancho de partida cuando no hay nada guardado. `defaultColumn.minSize` es 48 px
  (el mismo mínimo que aplica el teclado) para no dejar una columna ilegible.
- **`grouping({ initial?: string })`**: agrupa filas por una columna con `meta.groupable`, con
  filas de grupo expandibles (`initialState: { expanded: true }`) y agregados. Aporta un
  `slots.toolbar` con un `<select>` nativo «Agrupar por» (las columnas con `meta.groupable`, 44 px)
  y un `slots.columnMenu` con el item «Agrupar por <columna>»/«Quitar agrupación» (solo aplica a
  columnas `meta.groupable`, vía `canApply`). `opts.initial` fija la columna agrupada (por id) al
  montar; sin ella arranca sin agrupar — solo se agrupa por una columna a la vez (agrupar por otra
  sustituye la anterior, no la anida). La fila de grupo muestra el valor agrupado, el conteo de
  filas y las celdas agregadas de las columnas con `meta.aggregate`; en móvil, `parts/cards.tsx` la
  pinta como un encabezado (`<h3>`) en vez de una tarjeta, y sus filas hijas siguen siendo tarjetas
  normales bajo ese encabezado. **`meta.aggregate: 'sum'`** no usa el `sum` nativo de TanStack
  (`aggregationFn_sum`, que solo suma valores con `typeof value === 'number'`): el dinero de este
  proyecto viaja como cadena decimal (`"45.00"`, `docs/conventions.md` §4), así que ese `sum` daría
  `0.00`. `useDataGrid` registra en su lugar una agregación propia (`constructAggregationFn`,
  `use-data-grid.ts`) que convierte cada valor con `Number()` antes de sumar e ignora los que
  resulten `NaN`: acepta números y cadenas decimales por igual. `meta.aggregate: 'count'` usa el
  `count` nativo de TanStack.
- **`advancedFilter()`**: constructor de condiciones columna · operador · valor combinadas con Y/O,
  sobre las columnas con `meta.filter` (excluye las que no tienen un valor resoluble, como una
  columna `display` de acciones). Aporta un `slots.toolbar` con el botón «Filtro avanzado» (abre el
  diálogo, `advanced-filter-dialog.tsx`) y un chip por condición activa con su botón de quitar. Los
  operadores dependen de `meta.filter`: `'text'` ofrece contiene/es/no es/empieza con; `'range'`
  ofrece es/no es/mayor que/menor que/entre; `'select'` ofrece solo **es/no es** (un conjunto
  cerrado de valores no admite «contiene» ni «empieza con»). Filtra las filas con `transformData`
  (no con `columnFilteringFeature`) antes de que TanStack construya la tabla, así que **solo
  funciona en `mode: 'client'`**: en `mode: 'server'` no filtra nada y su toolbar no se renderiza.
  El estado vive fuera de React (`advanced-filter-store.ts`, un `Map` por `key` de grid) y se
  sincroniza con `dataSignal` (ver «Transformar filas» más abajo); se limpia al desmontar para que
  remontar un grid con la misma `key` no arrastre condiciones de la vez anterior.
- **`pinning({ left?: string[]; right?: string[] })`**: fija columnas a la izquierda (`left`, región
  lógica `start`) o a la derecha (`right`, región `end`) con `position: sticky`; `left`/`right` fijan
  las columnas iniciales al montar (por id) cuando no hay nada guardado. Aporta un `slots.columnMenu`
  con «Fijar a la izquierda»/«Fijar a la derecha» (solo el lado en el que la columna no está ya
  fijada) y «Soltar» (solo si está fijada), y guarda el resultado en `localStorage`
  (`datagrid:<key>:pinning`, restaurado al montar). Registra `columnPinningFeature` **y**
  `columnSizingFeature` de TanStack: `column.getStart()`/`column.getAfter()` (el desplazamiento
  sticky que usa `parts/pinning-styles.ts`) viven en la feature de tamaño, no en la de fijado —
  confirmado contra los tipos de `@tanstack/table-core` 9.2.4, ver el reporte de la Tarea 16. El
  offset se calcula con `columnDef.size`, que `use-data-grid.ts` rellena desde `meta.width` de
  forma **incondicional** (no depende de que la feature `resizing` esté registrada): una columna
  fijada con `meta.width` declarado usa ese ancho real para su desplazamiento sticky aunque la
  tabla no tenga `resizing`; solo cae al tamaño por defecto de columna (150 px) cuando la columna
  no declara `meta.width`. La sombra del borde de la última columna fijada a la izquierda / primera
  fijada a la derecha se calcula con
  `table.getStartVisibleLeafColumns()`/`getEndVisibleLeafColumns()` (no
  `column.getIsLastColumn()`/`getIsFirstColumn()`, que viven en `columnOrderingFeature` — una
  feature que `pinning` no registra porque no la necesita para nada más). El fondo sticky de la
  celda fijada es opaco (`var(--card)`, con mayor especificidad que las clases de `TableRow`), así
  que pisa `hover:bg-muted/50` y `data-[state=selected]:bg-muted`: en una tabla con hover o
  selección de fila, la celda fijada no se resalta igual que el resto de la fila. Es el mismo
  trade-off del patrón oficial de TanStack (que usa `background: 'Canvas'`), no un bug; el arreglo
  real (tokens semitransparentes o capas) se decide si la revisión UI/UX lo pide. **`grouping` +
  `pinning` combinadas no se han probado**: ninguna tabla del proyecto usa ambas a la vez (productos
  agrupa y no fija; trabajos fija y no agrupa). `parts/table.tsx` sí aplica `pinningStyles` a
  las celdas de la fila de grupo (mismo helper que las filas normales), pero esa combinación no
  tiene test ni verificación visual — confírmalo antes de usarlas juntas en una tabla nueva.
- **`urlState({ search: { pagina?, orden?, q? }, navigate, pageSize })`**: sincroniza paginación,
  orden y búsqueda global con los parámetros de la URL de la ruta, para `mode: 'server'` (ver
  «Modo servidor»). No aporta ningún slot (ni `toolbar` ni `headerCell`): no cuenta para el umbral
  de plegado de la toolbar en móvil y no dibuja nada por sí misma — el control real (el buscador de
  `filtering`, el botón de orden de `sorting`, los botones de `DataGrid.Pagination`) lo aporta la
  feature correspondiente; `urlState` solo traduce sus cambios a la URL y siembra el estado inicial
  de la tabla desde `search`. `opts.search` viene de la ruta ya validado con el schema de `shared`
  (`caseListQuerySchema.partial()` en trabajos): el grid nunca valida ni conoce ese schema.
  `opts.navigate(patch)` es responsabilidad de la ruta (normalmente `router.navigate({ search: prev
  => ({ ...prev, ...patch }) })`); cambiar orden o búsqueda vuelve a la página 1 (`pagina:
  undefined` en el patch — la ruta trata `pagina` ausente como 1, igual que el resto del listado).
  Registra siempre `globalFilteringFeature` de TanStack (aunque `filtering` no esté en la lista de
  features de esa tabla) para que `table.state.globalFilter`/`table.setGlobalFilter` existan sin
  depender de que otra feature los registre primero — cada módulo es independiente (regla de
  aislamiento, ver «Convenciones y límites conocidos»); registrarlo dos veces cuando `filtering`
  también lo trae no es un conflicto porque ambos importan el mismo objeto de
  `@tanstack/react-table`. Ejemplo real: `cases-table.tsx` le pasa solo `pagina`/`orden` (el
  buscador `q` de trabajos vive en `CasesFilters`, fuera del grid, así que pasar `search.q` sería
  inofensivo pero innecesario sin `filtering()` registrada).

Sin `pagination`, el grid muestra todas las filas sin paginar; sin `sorting`, las cabeceras no
tienen botón de orden y las filas conservan el orden del array de `data` (útil para listas con
orden manual, como fases); sin `filtering`, no hay ni buscador ni filtros de columna aunque las
columnas tengan `meta.filter`; sin `resizing`, las columnas no se pueden redimensionar y `meta.width`
no tiene efecto sobre el ancho de la columna (con `pinning` sí se usa para el desplazamiento
sticky, ver la feature `pinning`); sin `grouping`, no hay «Agrupar por» ni filas de grupo aunque las columnas
tengan `meta.groupable`/`meta.aggregate`; sin `advancedFilter`, no hay botón «Filtro avanzado» ni
chips aunque las columnas tengan `meta.filter` (el filtro por columna de `filtering` sigue
funcionando igual); sin `pinning`, no hay «Fijar a la izquierda/derecha» en el menú de columna ni
`position: sticky` en ninguna celda; sin `urlState`, el orden/paginación/búsqueda del grid viven
solo en `table.state` (se pierden al recargar la página o compartir la URL) y ninguna feature toca
`navigate` de la ruta.

## Tarjetas móviles

Por defecto (`renderCard` ausente), `parts/cards.tsx` genera la tarjeta a partir de `meta.mobile`
de cada columna:

- `title` y `badge` van en la primera fila, título a la izquierda y badge a la derecha.
- Las columnas `subtitle` se concatenan en una sola línea separadas por " · ", omitiendo las que
  tengan valor `null`/`undefined`/`''` (y su separador) — así una columna opcional vacía no deja un
  " · " colgando. El separador lleva `whitespace-nowrap` (sus dos espacios internos no son punto de
  quiebre de línea) y el contenedor de la línea neutraliza cualquier descendiente `display: block`
  con `[&_.block]:inline`: una celda que usa `block truncate` para elipsar en la columna angosta de
  la tabla de escritorio (p. ej. `products-table.tsx`, columna «Código») se reutiliza tal cual en
  la tarjeta, y sin esta neutralización ese `block` fuerza su propia línea sin importar el
  `white-space` del separador que lo sigue — juntos evitan que el separador quede huérfano al
  inicio de la línea siguiente.
- Cada columna `detail` se pinta en su propia línea como `<header>: <valor>` (usa el `header` de
  texto de la columna, o su `id` si el header no es texto).
- `actions` se pinta tal cual (normalmente los mismos botones/switches que la columna de acciones
  de escritorio).
- `hidden` no aparece en la tarjeta (por ejemplo una columna que solo tiene sentido en la tabla
  ancha, como "Crédito: N días" cuando ya sobra espacio en escritorio pero no en la tarjeta).

Cuando la tarjeta automática no alcanza — fases numera con la posición real en el array, no con el
índice de la fila renderizada, por ejemplo — pasa `renderCard={(row) => <...>}` a `DataGrid.Root`:
reemplaza toda la tarjeta para esa tabla, y `meta.mobile` deja de tener efecto (las columnas siguen
existiendo para la tabla de escritorio y para el filtrado/orden, pero no aportan nada a la
tarjeta).

## Modo servidor

`mode: 'server'` (junto con `rowCount`) declara que `data` ya viene paginada/ordenada/filtrada por
la API: `useDataGrid` activa `manualPagination`, `manualSorting` y `manualFiltering` y usa
`rowCount` para calcular el número de páginas y el conteo de `DataGrid.Pagination`. El grid nunca
llama a la API por sí mismo — sigue siendo responsabilidad de la ruta/hook armar la query con
TanStack Query y pasar `data` + `rowCount` ya resueltos. Enlazar el estado de orden y paginación
del grid con los parámetros de la URL (`orden`, `pagina`) es trabajo de la feature `urlState` (ver
más arriba).

Ejemplo real (`apps/web/src/features/cases/cases-table.tsx` + `routes/_app/trabajos/index.tsx`,
Tarea 18): la ruta valida `search` con `caseListQuerySchema.partial().catch({})`
(`case-views.ts:parseCasesSearch`) y arma la query de `useCases` (TanStack Query) con ese `search`;
`CasesTable` recibe `rows` + `total` ya resueltos, y `search`/`onSearchChange` para que `urlState`
lea y escriba la URL:

```tsx
const grid = useDataGrid({
  key: 'trabajos',
  columns,
  data: rows, // ya paginado/ordenado por la API
  features: [
    sorting(),
    pagination({ pageSize: CASE_PAGE_SIZE }),
    // `resizing`: sin ella, `sorting` + `pinning` añaden un botón de orden y un menú "⋮" a
    // cada cabecera y, sin `table-layout: fixed`, el ancho crece para acomodarlos — la tabla
    // deja de caber en el presupuesto de 960 px a 1280 px (ver el comentario en cases-table.tsx).
    resizing(),
    pinning({ left: ['codigo'] }),
    urlState({
      search: { pagina: search.pagina, orden: search.orden },
      navigate: (patch) => onSearchChange(patch as Partial<CaseListQuery>),
      pageSize: CASE_PAGE_SIZE,
    }),
  ],
  mode: 'server',
  rowCount: total,
  getRowId: (r) => r.id,
})
```

`orden` viaja como `'campo' | 'campo-desc'` (`ordenToSorting`/`sortingToOrden` en `url-state.ts`) y
sus valores válidos son `CASE_ORDERS` (`packages/shared/src/schemas/cases.ts`): **el id de cada
columna ordenable de la tabla debe ser una de las bases de `CASE_ORDERS`** (`codigo`, `entrega`,
`clinica`, `estado`) o su sufijo `-desc`, porque `parseCasesSearch` valida el `orden` que llega por
la URL y, si no es válido, no descarta solo el orden: como el `.catch({})` de esa ruta cubre el
objeto **entero**, un id renombrado sin avisar borraría también la vista, los filtros y la página
(`cases-table.test.tsx`, test «cada columna ordenable produce un `orden` válido en CASE_ORDERS»,
guarda añadida en la Tarea 19). La API valida `orden` en `caseListQuerySchema` y ordena de verdad
en `repo.ts` (`apps/api/src/features/cases/`) — este documento no repite esa parte, ver
`docs/architecture.md` §3.2 y §4.

`advancedFilter` filtra con `transformData` sobre `data` de cliente (ver «Transformar filas» más
abajo), así que **no funciona en `mode: 'server'`**: su `toolbar` no se renderiza si `init.mode ===
'server'`.

## Qué tabla usa qué feature

Estado real del código (verificado contra `features` en cada `*-table.tsx`, Tarea 19):

| Tabla | Modo | `pagination` | `sorting` | `filtering` | `advancedFilter` | `grouping` | `resizing` | `pinning` | `urlState` |
|---|---|---|---|---|---|---|---|---|---|
| `clinics-table.tsx` | cliente | ✓ | ✓ | ✓ (buscador) | — | — | — | — | — |
| `doctors-table.tsx` | cliente | ✓ | ✓ | ✓ (buscador) | — | — | — | — | — |
| `users-table.tsx` | cliente | ✓ | ✓ | ✓ (buscador) | — | — | — | — | — |
| `stages-table.tsx` | cliente | — | — | — | — | — | — | — | — |
| `clinic-prices-table.tsx` | cliente | ✓ | ✓ | ✓ (buscador) | — | — | — | — | — |
| `products-table.tsx` | cliente | ✓ | ✓ | ✓ (buscador + columnas) | ✓ | ✓ (por categoría) | ✓ | — | — |
| `cases-table.tsx` | **servidor** | ✓ | ✓ | — (`CasesFilters`, fuera del grid) | — | — | ✓ | ✓ (`codigo` izq.) | ✓ |

`stages-table.tsx` no usa ninguna feature de orden/filtro/paginación a propósito: las fases tienen
un orden manual propio (Subir/Bajar en la tabla, sin drag) que una lista reordenable no debe
mezclar con orden por columna; su `FEATURES` es un array vacío (`GridFeature[] = []`) y usa
`renderCard` propio (ver «Tarjetas móviles»). `cases-table.tsx` es la única en modo servidor y la
única con `resizing`/`pinning`/`urlState`; `products-table.tsx` es la única con `advancedFilter`/
`grouping`. Ninguna tabla combina `grouping` con `pinning` (ver la nota en la feature `pinning`
más arriba) ni `advancedFilter` con `mode: 'server'` (no tendría efecto).

## Convenciones y límites conocidos

- El estado del grid se lee con `table.state.<porción>` (por ejemplo `table.state.globalFilter`,
  `table.state.pagination`), **no** con `table.getState()` — es la forma que expone `useTable` de
  TanStack v9 con `tableFeatures()`.
- Dentro de `parts/*` y de los slots que aporta una feature (`headerCell`, `toolbar`,
  `columnMenu`), el hook de contexto se usa como `useGrid<never>()`: esas piezas son genéricas
  sobre el tipo de fila, no conocen `Clinic`, `User`, etc.
- Ninguna feature de `features/` importa otra, y el núcleo (`use-data-grid.ts`, `data-grid.tsx`,
  `parts/*`) no importa nada de `features/`: solo conoce el contrato `GridFeature` y pregunta
  `grid.has(id)` antes de usar algo de una feature concreta. Esto se verifica con tests que montan
  el grid con la feature y sin ella (ver «Cómo añadir una feature») **y con `pnpm lint`**:
  `eslint.config.js` tiene un bloque para el núcleo (`use-data-grid.ts`, `data-grid.tsx`,
  `context.ts`, `define-columns.ts`, `types.ts`, `parts/**`, con `index.ts` excluido a propósito
  porque re-exporta las factorías) que prohíbe importar `features/*`, otro para `features/*.{ts,tsx}`
  que prohíbe importar el núcleo o un módulo hermano (sus propios sub-archivos, como
  `filtering-column-filter.tsx`, sí se pueden importar), y uno general para todo `data-grid/**` que
  prohíbe `@/features/*`, `@/routes/*` y `@/lib/api` (docs/architecture.md §3.5).
- `GridFeatures` (`types.ts`) es el conjunto **completo** de features de TanStack que el tipado
  conoce; en runtime `useDataGrid` solo registra las que trae la lista `features` de esa tabla. Es
  lo que permite tipar `defineColumns`/`useDataGrid` una sola vez sin acoplar cada tabla a la unión
  total.
- **Limitación conocida**: en una celda (`cell: (c) => ...`), `c.getValue()` puede inferirse como
  `unknown` bajo el tipo compuesto `GridFeatures` en vez del tipo real del campo — sobre todo al
  indexar un `Record` con el valor. La solución es leer `c.row.original.<campo>` en su lugar, que
  sí conserva el tipo de la fila. Ejemplo real (`apps/web/src/features/users/users-table.tsx`):

  ```ts
  // c.getValue() no tipa el valor bajo GridFeatures; se usa row.original, ya tipado como UserRole.
  cell: (c) => <Badge variant="outline">{ROLE_LABEL[c.row.original.role]}</Badge>,
  ```

- **Limitación conocida**: TanStack renderiza `columnDef.cell` con `flexRender`, que trata
  cualquier `cell` de tipo función como un **componente** (`React.createElement(cell, context)`),
  no como una llamada de una sola vez. Si `cell` es un `(c) => <Input value={draftDeAlgunEstado} />`
  definido **dentro** del cuerpo de la tabla (o en un array de columnas sin memoizar), es una
  función NUEVA en cada render — React la trata como un componente distinto y desmonta/vuelve a
  montar esa celda, perdiendo el foco a mitad de tecleo en un input controlado (hallazgo real de la
  Tarea 14, `clinic-prices-table.tsx`: escribir un precio perdía todos los caracteres salvo el
  primero). La columna con ese `cell` necesita identidad **estable** entre renders (constante de
  módulo, como el resto de `defineColumns(...)` en «Ejemplo completo», o memoizada sin depender del
  estado que cambia con cada tecla); si esa celda necesita datos que sí cambian con cada tecla
  (borradores por fila, por ejemplo), pásalos por un `React.Context` propio de la feature en vez de
  por closure — el componente de celda lee `useContext` en cada invocación y el `Provider` puede
  recibir un valor nuevo en cada render sin que eso desmonte nada (ejemplo real:
  `apps/web/src/features/products/clinic-prices-table.tsx`, `DraftsContext` + `SpecialCell`).

## Cómo añadir una feature

Cada módulo de `features/` exporta una factoría que construye un `GridFeature`
(`apps/web/src/components/data-grid/types.ts`):

```ts
export type GridFeature = {
  id: GridFeatureId
  tanstack: Record<string, unknown>              // features/row models/fns de TanStack a fusionar
  options?: (init: GridInit) => Partial<TableOptions<GridFeatures, never>>
  initialState?: Record<string, unknown>
  transformData?: (rows: never[], init: GridInit) => never[]  // ver «Transformar filas» abajo
  dataSignal?: (init: GridInit) => GridDataSignal              // ver «Transformar filas» abajo
  slots?: GridSlots                              // toolbar, headerCell, columnMenu, footer
}
```

`slots.columnMenu` no es un simple `ComponentType`: es `{ item: ComponentType<{ column }>,
canApply?: (column) => boolean }`. `parts/column-menu.tsx` filtra los items de todas las features
con `canApply?.(column) ?? true` (sin `canApply`, el item aplica a cualquier columna) y no
renderiza el botón «Opciones de la columna…» si ninguno aplica — así una columna sin, por ejemplo,
`meta.groupable` no muestra un menú vacío con el item de `grouping` dentro.

### Transformar filas: `transformData` y `dataSignal`

Una feature que necesita filtrar o transformar filas **antes** de que TanStack construya la tabla
(no vía `columnFilteringFeature`/`globalFilteringFeature`, por ejemplo porque combina varias
columnas con una lógica propia) declara `transformData`: `useDataGrid` lo aplica con `useMemo`,
encadenando el resultado de cada feature registrada en orden, antes de pasar `data` a `useTable`.
Recibe `(rows, init)` — igual que `options(init)` — porque una feature con estado fuera de React
necesita `init.key` para leer su propia entrada sin chocar con otro grid de la misma página, e
`init.mode` para no hacer nada en modo servidor si su lógica es solo de cliente. `GridFeature` no
es genérico sobre el tipo de fila (igual que `GridColumn<never>` en los slots): la implementación
castea `rows` dentro de la feature, nunca en el núcleo.

Si ese estado externo puede cambiar sin pasar por el estado de React (un filtro guardado en un
store propio, no en `table.state`), la feature también declara `dataSignal(init): GridDataSignal`
— el contrato mínimo de `useSyncExternalStore` (`subscribe(callback): unsubscribe` y
`getSnapshot(): unknown`, con `getSnapshot` estable mientras el valor no cambie). `useDataGrid`
combina la `dataSignal` de todas las features registradas en una sola suscripción
(`combineDataSignals`, en `use-data-grid.ts`) y usa su snapshot como dependencia del `useMemo` de
`transformData`: es lo único que fuerza recalcular cuando ese estado externo cambia, sin que el
núcleo conozca qué feature lo declaró ni qué guarda. Una feature cuyo `transformData` es puro
sobre `rows` (no lee nada fuera de React) no necesita `dataSignal`.

Ejemplo real: `features/advanced-filter.tsx` guarda su `AdvancedFilter` en
`features/advanced-filter-store.ts` (un `Map` por `key` de grid, ajeno al estado de la tabla) y
declara `dataSignal: (init) => advancedFilterSignal(init.key)` — memoizado por `key` para que
`subscribe`/`getSnapshot` sean la misma función entre renders. El slot `toolbar` (botón + chips)
limpia su entrada del store al desmontarse (`useEffect` con cleanup que llama
`clearAdvancedFilter(key)`), para que remontar un grid con la misma `key` no arrastre el filtro de
la vez anterior.

Un archivo por feature en `features/`, con su factoría con opciones tipadas (por ejemplo
`sorting({ multi })`, `filtering({ search, columns })`). Regla de aislamiento: una feature puede
importar `../types.ts`, `../context.ts` (para leer del grid vía `useGrid`), utilidades propias de
`../lib/` (por ejemplo `column-label.ts`, `normalize.ts`) y primitivas de `components/ui/`, pero
nunca otro módulo de `features/`. `use-data-grid.ts`, `data-grid.tsx` y `parts/*` tampoco importan
nada de `features/`: solo el contrato `GridFeature` y `grid.has(id)`.

Cada feature nueva se prueba dos veces: con la feature registrada (su comportamiento) y sin ella
(que el grid siga funcionando y que su UI no aparezca) — ver
`apps/web/src/components/data-grid/features/sorting.test.tsx`:

```ts
it('sin la feature no hay botones de orden', async () => {
  setMatchMedia(true)
  renderWithRouter(<Grid features={[]} />)
  await screen.findByRole('table')
  expect(screen.queryByRole('button', { name: /Ordenar por/ })).not.toBeInTheDocument()
})
```

## Ejemplo completo

`apps/web/src/features/clinics/clinics-table.tsx` — buscador con etiqueta visible, orden,
`enableGlobalFilter: false` en las columnas que no deben aportar al buscador, paginación, celda con
`Link` y `data-target-size`, y `emptyMessage` que distingue "sin resultados de búsqueda" de "aún no
hay clínicas".

Ver también `apps/web/src/features/stages/stages-table.tsx` (sin `sorting`/`pagination`/
`filtering`, orden manual y `renderCard` propio), `apps/web/src/features/users/users-table.tsx`
(la limitación de `c.getValue()` con `Record`), `apps/web/src/features/products/products-table.tsx`
(`grouping` + `advancedFilter` + `resizing`, la tabla con más features del proyecto) y
`apps/web/src/features/cases/cases-table.tsx` (`mode: 'server'`, `pinning` + `resizing` +
`urlState`, `renderCard` propio con la pestaña de color del ticket y columna `Total` enmascarada
por rol — ver «Modo servidor» más arriba para el ejemplo completo de montaje).

## Referencia

Spec de diseño original (arquitectura, contrato de feature, plan de migración por tabla) — **este
documento manda sobre la spec en cualquier punto donde difieran**: la spec describe el diseño tal
como se planeó el 2026-09-12, y varias decisiones cambiaron en el camino (rulings del ledger
`.superpowers/sdd/2026-09-13-data-grid/progress.md`, por ejemplo el umbral de plegado de la
toolbar en móvil, el contrato `dataSignal` o `GridInit.getRowValue`):
`docs/superpowers/specs/2026-09-12-data-grid-design.md`.
