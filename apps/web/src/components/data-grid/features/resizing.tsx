import { columnResizingFeature, columnSizingFeature } from '@tanstack/react-table'
import { useGrid } from '../context'
import { columnLabel } from '../lib/column-label'
import { readStored, writeStored } from '../storage'
import type { GridFeature, GridHeader } from '../types'

const STEP = 16
const MIN_SIZE = 48

function ResizeHandle({ header }: { header: GridHeader<never> }) {
  const grid = useGrid<never>()
  const column = header.column
  const label = columnLabel(column)
  const persist = () => writeStored(`datagrid:${grid.key}:sizing`, grid.table.state.columnSizing)

  return (
    <div
      role="separator"
      aria-label={`Redimensionar ${label}`}
      aria-orientation="vertical"
      tabIndex={0}
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      onMouseUp={persist}
      onTouchEnd={persist}
      onDoubleClick={() => {
        column.resetSize()
        persist()
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
        e.preventDefault()
        const next = Math.max(MIN_SIZE, column.getSize() + (e.key === 'ArrowRight' ? STEP : -STEP))
        // Se calcula el mapa completo aquí (en vez de leer `table.state.columnSizing` después de
        // `setColumnSizing`) para no depender de si esa actualización ya se aplicó cuando se lee.
        const sizing = { ...grid.table.state.columnSizing, [column.id]: next }
        grid.table.setColumnSizing(sizing)
        writeStored(`datagrid:${grid.key}:sizing`, sizing)
      }}
      className={`ml-auto h-6 w-1 cursor-col-resize touch-none rounded bg-border hover:bg-primary focus-visible:outline-2 ${
        column.getIsResizing() ? 'bg-primary' : ''
      }`}
    />
  )
}

/**
 * Anchos de columna redimensionables (arrastre y teclado ← → de 16 px) con persistencia local
 * por `key` (`datagrid:<key>:sizing`). `meta.width` (traducido a `size` en `useDataGrid`) es el
 * ancho inicial cuando no hay nada guardado.
 */
export function resizing(): GridFeature {
  return {
    id: 'resizing',
    tanstack: { columnSizingFeature, columnResizingFeature },
    options: (init) => ({
      columnResizeMode: 'onEnd',
      enableColumnResizing: true,
      defaultColumn: { minSize: MIN_SIZE },
      initialState: {
        columnSizing: readStored<Record<string, number>>(`datagrid:${init.key}:sizing`, {}),
      },
    }),
    slots: { headerCell: ResizeHandle },
  }
}
