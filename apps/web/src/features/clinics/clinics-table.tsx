import { Link } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'
import { useMemo } from 'react'
import { ActiveBadge } from '@/components/active-badge'
import {
  DataGrid,
  defineColumns,
  filtering,
  pagination,
  sorting,
  useDataGrid,
} from '@/components/data-grid'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { Clinic } from './api'

const FEATURES = [
  filtering({
    search: { id: 'clinicas-buscar', label: 'Buscar clínica', placeholder: 'Buscar por nombre' },
  }),
  sorting(),
  pagination(),
]

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
  const columns = useMemo(
    () =>
      defineColumns<Clinic>((col) => [
        col.accessor('name', {
          header: 'Clínica',
          meta: { mobile: 'title' },
          // `data-target-size="inline"`: identificador de fila, no una acción — cae en la
          // excepción "inline" del objetivo táctil (WCAG 2.5.8).
          cell: (c) => (
            <Link
              to="/configuracion/clinicas/$clinicId"
              params={{ clinicId: c.row.original.id }}
              data-target-size="inline"
              className="font-medium text-primary hover:underline"
            >
              {c.getValue()}
            </Link>
          ),
        }),
        col.accessor('city', {
          header: 'Ciudad',
          cell: (c) => c.getValue() ?? '—',
          meta: { mobile: 'subtitle' },
          enableGlobalFilter: false,
        }),
        col.accessor('whatsapp', {
          header: 'WhatsApp',
          cell: (c) => <span className="font-mono text-sm">{c.getValue() ?? '—'}</span>,
          meta: { mobile: 'subtitle' },
          enableGlobalFilter: false,
        }),
        col.accessor('paymentTermsDays', {
          header: 'Crédito',
          cell: (c) => `${c.getValue()} días`,
          meta: { mobile: 'hidden' },
          enableGlobalFilter: false,
        }),
        col.accessor('active', {
          header: 'Estado',
          cell: (c) => <ActiveBadge active={c.getValue()} />,
          meta: { mobile: 'badge' },
          enableGlobalFilter: false,
        }),
        col.display({
          id: 'actions',
          header: '',
          meta: { mobile: 'actions', align: 'right' },
          cell: (c) => {
            const clinic = c.row.original
            return (
              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar ${clinic.name}`}
                  onClick={() => onEdit(clinic)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Switch
                  checked={clinic.active}
                  aria-label={`${clinic.name} activa`}
                  onCheckedChange={(v) => onToggle(clinic, v)}
                />
              </div>
            )
          },
        }),
      ]),
    [onEdit, onToggle],
  )
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
      emptyMessage={(q) =>
        q
          ? `Ninguna clínica coincide con "${q}"`
          : 'Aún no hay clínicas. Crea la primera con Nueva clínica.'
      }
      emptyAction={emptyAction}
    >
      <DataGrid.Toolbar />
      <DataGrid.Content />
      <DataGrid.Pagination />
    </DataGrid.Root>
  )
}
