# DataGrid — guía de uso

Componente transversal en `apps/web/src/components/data-grid/` que reemplazó a `data-table.tsx`.
Construido sobre `@tanstack/react-table` 9.2.4 (`tableFeatures()` + `useTable`). Complementa
`docs/architecture.md` §3.3 (web hexagonal-lite) y es la implementación de la spec de diseño
`docs/superpowers/specs/2026-09-12-data-grid-design.md` — este documento describe **lo que existe
hoy** (núcleo + `sorting`, `pagination`, `filtering`); el resto de features del diseño (filtro
avanzado, agrupación, redimensionado, fijado de columnas, estado en URL) llegan en PRs
posteriores y no están documentadas aquí porque todavía no existen en el código.

## Qué es y cuándo usarlo

Un grid modular y "plug and play": cada capacidad (orden, paginación, filtros…) vive en su propio
módulo de `features/` y se activa añadiéndolo a un array; sin esa entrada, la capacidad no existe
en runtime. Úsalo para cualquier listado tabular nuevo o migrado (clínicas, doctores, usuarios,
fases hoy; productos, cuentas y trabajos en los próximos PRs). No lo uses para listas simples que
no necesitan orden, filtro ni paginación (una lista de tres elementos en un `<Select>`, por
ejemplo) — ahí un `<ul>` o `<table>` a mano sigue siendo más simple.

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
  'range'` (ver «Features disponibles»).
- **`align`**: `'left' | 'right'`; alinea la celda y su cabecera a la derecha (columnas numéricas o
  de acciones).
- **`width`**: ancho inicial en px. Hoy solo lo usará la feature de redimensionado (aún no
  implementada); declararlo ya no tiene efecto visual salvo el que le des con `cellClassName`.
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

- **`key`**: identificador estable de la tabla; nombra la persistencia futura en `localStorage`
  (`datagrid:<key>`, aún sin uso porque ninguna feature actual persiste estado).
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
  una aporta a `slots.toolbar` (hoy solo `filtering`). Si ninguna feature registrada tiene
  `toolbar`, no renderiza nada.
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
  varias columnas con Shift+clic (`enableMultiSort`).
- **`pagination({ pageSize?: number })`**: paginación cliente o servidor; tamaño de página por
  defecto 25 (`DEFAULT_PAGE_SIZE`). Su UI vive en `DataGrid.Pagination`, no en la toolbar: botones
  «Anterior»/«Siguiente» de 44 px, «Página N de M» y un conteo `aria-live="polite"` («Mostrando X
  a Y de Z») oculto visualmente para lectores de pantalla.
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

Sin `pagination`, el grid muestra todas las filas sin paginar; sin `sorting`, las cabeceras no
tienen botón de orden y las filas conservan el orden del array de `data` (útil para listas con
orden manual, como fases); sin `filtering`, no hay ni buscador ni filtros de columna aunque las
columnas tengan `meta.filter`.

## Tarjetas móviles

Por defecto (`renderCard` ausente), `parts/cards.tsx` genera la tarjeta a partir de `meta.mobile`
de cada columna:

- `title` y `badge` van en la primera fila, título a la izquierda y badge a la derecha.
- Las columnas `subtitle` se concatenan en una sola línea separadas por " · ", omitiendo las que
  tengan valor `null`/`undefined`/`''` (y su separador) — así una columna opcional vacía no deja un
  " · " colgando.
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
del grid con los parámetros de la URL (`orden`, `pagina`) es trabajo de la feature `urlState`, que
llega en un PR posterior — hoy `mode: 'server'` no tiene todavía ninguna tabla real que lo use.

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
  el grid con la feature y sin ella (ver «Cómo añadir una feature»).
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

## Cómo añadir una feature

Cada módulo de `features/` exporta una factoría que construye un `GridFeature`
(`apps/web/src/components/data-grid/types.ts`):

```ts
export type GridFeature = {
  id: GridFeatureId
  tanstack: Record<string, unknown>              // features/row models/fns de TanStack a fusionar
  options?: (init: GridInit) => Partial<TableOptions<GridFeatures, never>>
  initialState?: Record<string, unknown>
  slots?: GridSlots                              // toolbar, headerCell, columnMenu, footer
}
```

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
`filtering`, orden manual y `renderCard` propio) y `apps/web/src/features/users/users-table.tsx`
(la limitación de `c.getValue()` con `Record`).

## Referencia

Spec de diseño completa (arquitectura, contrato de feature, features futuras — filtro avanzado,
agrupación, redimensionado, fijado de columnas, `urlState`, plan de migración por tabla):
`docs/superpowers/specs/2026-09-12-data-grid-design.md`.
