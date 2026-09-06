import { Pencil } from 'lucide-react'
import { ActiveBadge } from '@/components/active-badge'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { Doctor } from './api'

export function DoctorsTable({
  doctors,
  onEdit,
  onToggle,
  emptyAction,
}: {
  doctors: Doctor[]
  onEdit: (d: Doctor) => void
  onToggle: (d: Doctor, active: boolean) => void
  emptyAction?: React.ReactNode
}) {
  const actions = (d: Doctor) => (
    <div className="flex items-center justify-end gap-3">
      <Button variant="ghost" size="icon" aria-label={`Editar ${d.name}`} onClick={() => onEdit(d)}>
        <Pencil className="size-4" />
      </Button>
      <Switch
        checked={d.active}
        aria-label={`${d.name} activo`}
        onCheckedChange={(v) => onToggle(d, v)}
      />
    </div>
  )
  return (
    <DataTable
      rows={doctors}
      getRowId={(d) => d.id}
      emptyMessage="Esta clínica aún no tiene doctores."
      emptyAction={emptyAction}
      columns={[
        {
          key: 'name',
          header: 'Doctor',
          cell: (d) => <span className="font-medium">{d.name}</span>,
        },
        {
          key: 'phone',
          header: 'Teléfono',
          cell: (d) => <span className="font-mono text-sm">{d.phone ?? '—'}</span>,
        },
        { key: 'email', header: 'Correo', cell: (d) => d.email ?? '—' },
        { key: 'active', header: 'Estado', cell: (d) => <ActiveBadge active={d.active} /> },
        { key: 'actions', header: '', cell: actions, className: 'text-right' },
      ]}
      renderMobile={(d) => (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{d.name}</span>
            <ActiveBadge active={d.active} />
          </div>
          <p className="text-sm text-muted-foreground">
            {[d.phone, d.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
          </p>
          {actions(d)}
        </div>
      )}
    />
  )
}
