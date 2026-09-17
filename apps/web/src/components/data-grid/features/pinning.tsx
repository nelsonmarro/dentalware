import { columnPinningFeature, columnSizingFeature } from '@tanstack/react-table'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useGrid } from '../context'
import { readStored, writeStored } from '../storage'
import type { GridColumn, GridFeature } from '../types'

type PinState = { start: string[]; end: string[] }

function PinMenuItems({ column }: { column: GridColumn<never> }) {
  const grid = useGrid<never>()
  const pinned = column.getIsPinned()
  // No se usa `column.pin(pos)` seguido de un `persist()` que relea `grid.table.state.columnPinning`:
  // `table.state` es el snapshot que `useTable` selecciona para el render de React (`useSelector`
  // sobre el store de TanStack), y no refleja el cambio hasta el siguiente render — persistiría el
  // valor ANTERIOR. Se calcula aquí el próximo estado con la misma lógica que `column_pin` de
  // TanStack (mueve los ids de las columnas hoja al lado pedido, quitándolos de ambos primero) para
  // tener el valor final en la misma llamada, igual que el manejador de teclado de
  // `features/resizing.tsx` computa `sizing` a mano en vez de releer el estado tras mutar.
  const pin = (position: 'start' | 'end' | false) => {
    const leafIds = column.getLeafColumns().map((c) => c.id)
    const old = grid.table.state.columnPinning
    const next: PinState = {
      start:
        position === 'start'
          ? [...old.start.filter((id) => !leafIds.includes(id)), ...leafIds]
          : old.start.filter((id) => !leafIds.includes(id)),
      end:
        position === 'end'
          ? [...old.end.filter((id) => !leafIds.includes(id)), ...leafIds]
          : old.end.filter((id) => !leafIds.includes(id)),
    }
    grid.table.setColumnPinning(next)
    writeStored(`datagrid:${grid.key}:pinning`, next)
  }
  return (
    <>
      {pinned !== 'start' && (
        <DropdownMenuItem onSelect={() => pin('start')}>Fijar a la izquierda</DropdownMenuItem>
      )}
      {pinned !== 'end' && (
        <DropdownMenuItem onSelect={() => pin('end')}>Fijar a la derecha</DropdownMenuItem>
      )}
      {pinned && <DropdownMenuItem onSelect={() => pin(false)}>Soltar</DropdownMenuItem>}
    </>
  )
}

/**
 * Columnas fijadas a izquierda (`start`) o derecha (`end`), con persistencia local por `key`
 * (`datagrid:<key>:pinning`). Aporta un `slots.columnMenu` con «Fijar a la izquierda»/«Fijar a la
 * derecha»/«Soltar» (los dos primeros solo se ofrecen si la columna no está ya fijada en ese
 * lado). Registra `columnSizingFeature` además de `columnPinningFeature`: `column.getStart()` y
 * `column.getAfter()` (que `parts/pinning-styles.ts` usa para el desplazamiento sticky) viven en
 * `columnSizingFeature`, no en la de fijado (ver el reporte de la Tarea 16 — confirmado contra
 * los tipos de `@tanstack/table-core` 9.2.4). El offset se calcula con `columnDef.size`, que
 * `use-data-grid.ts` rellena desde `meta.width` de forma incondicional (no depende de que
 * `resizing` esté registrada): una columna fijada con `meta.width` declarado usa ese ancho real
 * para su desplazamiento sticky aunque la tabla no tenga `resizing`; solo cae al tamaño por
 * defecto de columna (150 px) cuando la columna no declara `meta.width`.
 */
export function pinning(opts: { left?: string[]; right?: string[] } = {}): GridFeature {
  return {
    id: 'pinning',
    tanstack: { columnPinningFeature, columnSizingFeature },
    options: (init) => ({
      enableColumnPinning: true,
      initialState: {
        columnPinning: readStored<PinState>(`datagrid:${init.key}:pinning`, {
          start: opts.left ?? [],
          end: opts.right ?? [],
        }),
      },
    }),
    slots: { columnMenu: { item: PinMenuItems } },
  }
}
