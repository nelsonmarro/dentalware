import { ChevronDown } from 'lucide-react'
import { useMediaQuery } from '@/lib/use-media-query'
import { useGrid } from '../context'
import type { GridTable } from '../types'

// Tailwind `lg` empieza en 1024px; debe coincidir con las clases `lg:*` del resto de partes
// (`data-grid.tsx`, `header-cell.tsx`…) — se repite aquí en vez de importarla porque no está
// exportada.
const DESKTOP_QUERY = '(min-width: 1024px)'

/**
 * Cuenta controles de la barra con un valor activo, para el contador del `<summary>` plegado en
 * móvil. Se lee solo de `table.state` (genérico, sin conocer ninguna feature): búsqueda global con
 * texto, filtros de columna con valor, agrupación activa y orden activo. El filtro avanzado
 * (`features/advanced-filter-store.ts`) queda **fuera** a propósito: su estado vive fuera de
 * `table.state`, en un store propio de la feature, y contarlo aquí obligaría al núcleo a importar
 * `features/advanced-filter.tsx` — la misma razón por la que el núcleo no distingue el buscador
 * global de columnas del resto de controles de `filtering` (ver comentario en `GridToolbar` más
 * abajo). Documentado también en `docs/data-grid.md`.
 */
function countActiveControls(state: GridTable<never>['state']): number {
  let count = 0
  if (typeof state.globalFilter === 'string' && state.globalFilter.trim() !== '') count += 1
  count += state.columnFilters?.length ?? 0
  if (state.grouping && state.grouping.length > 0) count += 1
  if (state.sorting && state.sorting.length > 0) count += 1
  return count
}

/**
 * Monta los slots `toolbar` de las features registradas, en el orden de registro. Sin slots no
 * renderiza nada. `role="search"` solo cuando `filtering` está registrada: es la única feature
 * cuya toolbar es un formulario de búsqueda; el resto (orden en móvil, agrupar, columnas…) no lo es.
 *
 * Bajo `lg` (`< 1024px`), los slots se pliegan dentro de un `<details>` con `<summary>` «Filtros y
 * orden» (+ contador de controles activos, ver `countActiveControls`) **solo cuando 3 o más
 * features registradas aportan un slot `toolbar`** (Tarea 14, ruling del controlador): con
 * `sorting` + `filtering` + `grouping` + `advancedFilter` a la vez (caso real de productos, Tarea
 * 13) la barra móvil apilaba nueve controles antes de la primera tarjeta, pero con 1 o 2 (clínicas,
 * doctores, usuarios, precios especiales: `filtering` + `sorting`) plegar solo escondía el
 * buscador que recepción usa a diario sin ahorrar espacio real. El umbral se cuenta desde
 * `grid.features` (genérico, sin conocer ninguna feature en concreto) y no de la lista de
 * `controls` ya montados, que es la misma cantidad. `<details>` es una revelación nativa: el
 * estado abierto/cerrado y su semántica de accesibilidad (equivalente a `aria-expanded` en el
 * `<summary>`) los da el navegador, sin JS propio. El buscador global de `filtering` NO queda fuera
 * del plegado: su slot es un único componente que pinta el buscador y los filtros de columna
 * juntos (`features/filtering.tsx:Toolbar`), así que separarlo exigiría tocar esa feature — fuera
 * del alcance de este fix (núcleo, un solo archivo). En `lg` y superior, o con menos de 3 slots, la
 * barra se ve siempre plana (sin `<details>`).
 */
export function GridToolbar() {
  const grid = useGrid<never>()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const slots = grid.features.flatMap((f) =>
    f.slots?.toolbar ? [{ id: f.id, Slot: f.slots.toolbar }] : [],
  )
  if (slots.length === 0) return null
  const controls = slots.map(({ id, Slot }) => <Slot key={id} />)
  const searchRole = grid.has('filtering') ? 'search' : undefined
  const foldsOnMobile = slots.length >= 3

  if (isDesktop || !foldsOnMobile) {
    return (
      <div role={searchRole} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {controls}
      </div>
    )
  }

  const count = countActiveControls(grid.table.state)
  return (
    <details className="rounded-xl border border-border bg-card">
      <summary className="flex h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 text-sm font-medium">
        <span>Filtros y orden{count > 0 ? ` (${count})` : ''}</span>
        <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
      </summary>
      <div role={searchRole} className="flex flex-col gap-3 border-t border-border p-4">
        {controls}
      </div>
    </details>
  )
}
