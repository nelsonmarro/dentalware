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
import type { Doctor } from './api'

const FEATURES = [
  filtering({ search: { id: 'doctores-buscar', label: 'Buscar doctor' } }),
  sorting(),
  pagination(),
]

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
  const columns = useMemo(
    () =>
      defineColumns<Doctor>((col) => [
        col.accessor('name', {
          header: 'Doctor',
          meta: { mobile: 'title' },
          cell: (c) => <span className="font-medium">{c.getValue()}</span>,
        }),
        col.accessor('phone', {
          header: 'Teléfono',
          cell: (c) => <span className="font-mono text-sm">{c.getValue() ?? '—'}</span>,
          meta: { mobile: 'subtitle' },
          enableGlobalFilter: false,
        }),
        col.accessor('email', {
          header: 'Correo',
          cell: (c) => c.getValue() ?? '—',
          meta: { mobile: 'subtitle' },
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
            const doctor = c.row.original
            return (
              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar ${doctor.name}`}
                  onClick={() => onEdit(doctor)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Switch
                  checked={doctor.active}
                  aria-label={`${doctor.name} activo`}
                  onCheckedChange={(v) => onToggle(doctor, v)}
                />
              </div>
            )
          },
        }),
      ]),
    [onEdit, onToggle],
  )
  const grid = useDataGrid({
    key: 'doctores',
    columns,
    data: doctors,
    features: FEATURES,
    getRowId: (d) => d.id,
  })
  return (
    <DataGrid.Root
      grid={grid}
      emptyMessage={(q) =>
        q ? `Ningún doctor coincide con "${q}"` : 'Esta clínica aún no tiene doctores.'
      }
      emptyAction={emptyAction}
    >
      <DataGrid.Toolbar />
      <DataGrid.Content />
      <DataGrid.Pagination />
    </DataGrid.Root>
  )
}
