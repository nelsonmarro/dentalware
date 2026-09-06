import { Link } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'
import { ActiveBadge } from '@/components/active-badge'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { Clinic } from './api'

export function ClinicsTable({
  clinics,
  onEdit,
  onToggle,
  emptyAction,
}: {
  clinics: Clinic[]
  onEdit: (c: Clinic) => void
  onToggle: (c: Clinic, active: boolean) => void
  emptyAction?: React.ReactNode
}) {
  const nameLink = (c: Clinic) => (
    <Link
      to="/configuracion/clinicas/$clinicId"
      params={{ clinicId: c.id }}
      className="font-medium text-primary hover:underline"
    >
      {c.name}
    </Link>
  )
  const actions = (c: Clinic) => (
    <div className="flex items-center justify-end gap-2">
      <Button variant="ghost" size="icon" aria-label={`Editar ${c.name}`} onClick={() => onEdit(c)}>
        <Pencil className="size-4" />
      </Button>
      <Switch
        checked={c.active}
        aria-label={`${c.name} activa`}
        onCheckedChange={(v) => onToggle(c, v)}
      />
    </div>
  )
  return (
    <DataTable
      rows={clinics}
      getRowId={(c) => c.id}
      emptyMessage="Aún no hay clínicas. Crea la primera con Nueva clínica."
      emptyAction={emptyAction}
      columns={[
        { key: 'name', header: 'Clínica', cell: nameLink },
        { key: 'city', header: 'Ciudad', cell: (c) => c.city ?? '—' },
        {
          key: 'whatsapp',
          header: 'WhatsApp',
          cell: (c) => <span className="font-mono text-sm">{c.whatsapp ?? '—'}</span>,
        },
        { key: 'terms', header: 'Crédito', cell: (c) => `${c.paymentTermsDays} días` },
        { key: 'active', header: 'Estado', cell: (c) => <ActiveBadge active={c.active} /> },
        { key: 'actions', header: '', cell: actions, className: 'text-right' },
      ]}
      renderMobile={(c) => (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            {nameLink(c)}
            <ActiveBadge active={c.active} />
          </div>
          <p className="text-sm text-muted-foreground">
            {[c.city, c.whatsapp].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
          </p>
          {actions(c)}
        </div>
      )}
    />
  )
}
