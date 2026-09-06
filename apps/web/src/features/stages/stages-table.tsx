import { ArrowDown, ArrowUp, Pencil } from 'lucide-react'
import { ActiveBadge } from '@/components/active-badge'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { Stage } from './api'

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
  const swatch = (s: Stage) => (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: s.color }} />
      <span className="font-mono text-xs">{s.color}</span>
    </span>
  )
  const actions = (s: Stage, i: number) => (
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
      <Button variant="ghost" size="icon" aria-label={`Editar ${s.name}`} onClick={() => onEdit(s)}>
        <Pencil className="size-4" />
      </Button>
      <Switch
        checked={s.active}
        aria-label={`${s.name} activa`}
        onCheckedChange={(v) => onToggle(s, v)}
      />
    </div>
  )
  return (
    <DataTable
      rows={stages}
      getRowId={(s) => s.id}
      emptyMessage="Aún no hay fases. Crea la primera con Nueva fase."
      emptyAction={emptyAction}
      columns={[
        {
          key: 'sort',
          header: '#',
          cell: (s) => <span className="font-mono">{stages.indexOf(s) + 1}</span>,
          className: 'w-12',
        },
        { key: 'name', header: 'Fase', cell: (s) => <span className="font-medium">{s.name}</span> },
        { key: 'color', header: 'Color', cell: swatch },
        { key: 'active', header: 'Estado', cell: (s) => <ActiveBadge active={s.active} /> },
        {
          key: 'actions',
          header: '',
          cell: (s) => actions(s, stages.indexOf(s)),
          className: 'text-right',
        },
      ]}
      renderMobile={(s) => (
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
    />
  )
}
