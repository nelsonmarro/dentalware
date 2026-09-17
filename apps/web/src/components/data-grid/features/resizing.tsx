import { useEffect, useRef } from 'react'
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
  const isResizing = column.getIsResizing()
  const persist = () => writeStored(`datagrid:${grid.key}:sizing`, grid.table.state.columnSizing)

  // TanStack confirma el arrastre (ratón o dedo) con listeners de `mousemove`/`mouseup`/
  // `touchend` en `document` (`columnResizingFeature`), no en el asa de 4 px: un `onMouseUp`/
  // `onTouchEnd` en el propio `<div>` casi nunca corre porque el puntero suelta lejos de ahí. El
  // único punto seguro para persistir un arrastre es cuando `isResizing` pasa de `true` a
  // `false`, que es justo cuando TanStack ya escribió el ancho final en `columnSizing`.
  const wasResizing = useRef(isResizing)
  useEffect(() => {
    if (wasResizing.current && !isResizing) persist()
    wasResizing.current = isResizing
  })

  return (
    <div
      role="separator"
      aria-label={`Redimensionar ${label}`}
      aria-orientation="vertical"
      tabIndex={0}
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
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
      // Posicionada de forma absoluta (no `ml-auto` dentro del flex de la cabecera): un asa de 4
      // px casi no pesa visualmente, pero sí sumaba su ancho + el `gap-1` del contenedor al
      // contenido mínimo de CADA columna (`th` sin `table-layout: fixed`, así que ese mínimo
      // empuja el ancho real de la tabla). Sacarla del flujo deja el ancho de columna gobernado
      // solo por la etiqueta y el botón de orden/menú, sin cambiar su posición visual (ya vivía
      // pegada al borde derecho de la cabecera). Necesita `position: relative` en el `<th>`
      // (`parts/table.tsx`, condicionado a `hasResizing`).
      className={`absolute top-1/2 right-0 h-6 w-1 -translate-y-1/2 cursor-col-resize touch-none rounded bg-border hover:bg-primary focus-visible:outline-2 ${
        isResizing ? 'bg-primary' : ''
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
