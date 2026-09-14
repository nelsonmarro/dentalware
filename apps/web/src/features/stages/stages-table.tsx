import { ArrowDown, ArrowUp, Pencil } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { ActiveBadge } from '@/components/active-badge'
import { DataGrid, defineColumns, useDataGrid, type GridFeature } from '@/components/data-grid'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { Stage } from './api'

const FEATURES: GridFeature[] = []

export function StagesTable({
  stages,
  onEdit,
  onToggle,
  onMove,
  emptyAction,
}: {
  stages: Stage[]
  onEdit: (s: Stage) => void
  onToggle: (s: Stage, active: boolean) => void
  onMove: (s: Stage, dir: -1 | 1) => void
  emptyAction?: React.ReactNode
}) {
  // Compartidos entre la columna de escritorio (`actions`) y la tarjeta móvil (`renderCard`): sin
  // features el orden es el del array, así que el índice se calcula con `stages.indexOf`.
  // `useCallback` con dependencias explícitas: mantiene la referencia estable para que el
  // `useMemo` de `columns` solo recalcule cuando de verdad cambia algo que estas funciones usan.
  const swatch = useCallback(
    (s: Stage) => (
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: s.color }} />
        <span className="font-mono text-xs">{s.color}</span>
      </span>
    ),
    [],
  )
  const actions = useCallback(
    (s: Stage, i: number) => (
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Subir ${s.name}`}
          disabled={i === 0}
          onClick={() => onMove(s, -1)}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Bajar ${s.name}`}
          disabled={i === stages.length - 1}
          onClick={() => onMove(s, 1)}
        >
          <ArrowDown className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Editar ${s.name}`}
          onClick={() => onEdit(s)}
        >
          <Pencil className="size-4" />
        </Button>
        <Switch
          checked={s.active}
          aria-label={`${s.name} activa`}
          onCheckedChange={(v) => onToggle(s, v)}
        />
      </div>
    ),
    [onEdit, onMove, onToggle, stages.length],
  )
  const columns = useMemo(
    () =>
      defineColumns<Stage>((col) => [
        col.display({
          id: 'sort',
          header: '#',
          meta: { width: 48, mobile: 'hidden' },
          cell: (c) => <span className="font-mono">{c.row.index + 1}</span>,
        }),
        col.accessor('name', {
          header: 'Fase',
          meta: { mobile: 'title' },
          cell: (c) => <span className="font-medium">{c.getValue()}</span>,
        }),
        col.accessor('color', {
          header: 'Color',
          meta: { mobile: 'detail' },
          cell: (c) => swatch(c.row.original),
        }),
        col.accessor('active', {
          header: 'Estado',
          meta: { mobile: 'badge' },
          cell: (c) => <ActiveBadge active={c.getValue()} />,
        }),
        col.display({
          id: 'actions',
          header: '',
          meta: { mobile: 'actions', align: 'right' },
          cell: (c) => actions(c.row.original, c.row.index),
        }),
      ]),
    [swatch, actions],
  )
  const grid = useDataGrid({
    key: 'fases',
    columns,
    data: stages,
    features: FEATURES,
    getRowId: (s) => s.id,
  })
  return (
    <DataGrid.Root
      grid={grid}
      emptyMessage="Aún no hay fases. Crea la primera con Nueva fase."
      emptyAction={emptyAction}
      renderCard={(s) => (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {stages.indexOf(s) + 1}. {s.name}
            </span>
            <ActiveBadge active={s.active} />
          </div>
          {swatch(s)}
          {actions(s, stages.indexOf(s))}
        </div>
      )}
    >
      <DataGrid.Content />
    </DataGrid.Root>
  )
}
