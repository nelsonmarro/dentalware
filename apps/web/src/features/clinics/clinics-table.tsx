import { Link } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { ActiveBadge } from '@/components/active-badge'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { Clinic } from './api'

/** Insensible a mayúsculas y acentos: "gomez" coincide con "Gómez". */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

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
  const [search, setSearch] = useState('')
  const trimmedSearch = search.trim()
  const q = normalize(trimmedSearch)
  const filtered = q ? clinics.filter((c) => normalize(c.name).includes(q)) : clinics
  const nameLink = (c: Clinic) => (
    // `data-target-size="inline"`: identificador de fila/tarjeta, no una acción — cae en la
    // excepción "inline" del objetivo táctil (WCAG 2.5.8): el tamaño lo da el texto, como un
    // enlace dentro de una oración. Las acciones reales de la fila (Editar) sí miden 44 px.
    <Link
      to="/configuracion/clinicas/$clinicId"
      params={{ clinicId: c.id }}
      data-target-size="inline"
      className="font-medium text-primary hover:underline"
    >
      {c.name}
    </Link>
  )
  const actions = (c: Clinic) => (
    <div className="flex items-center justify-end gap-3">
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor="clinicas-buscar">Buscar clínica</Label>
        <Input
          id="clinicas-buscar"
          name="buscar"
          type="search"
          placeholder="Buscar por nombre"
          className="h-11"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <DataTable
        rows={filtered}
        getRowId={(c) => c.id}
        emptyMessage={
          trimmedSearch
            ? `Ninguna clínica coincide con "${trimmedSearch}"`
            : 'Aún no hay clínicas. Crea la primera con Nueva clínica.'
        }
        emptyAction={trimmedSearch ? undefined : emptyAction}
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
    </div>
  )
}
