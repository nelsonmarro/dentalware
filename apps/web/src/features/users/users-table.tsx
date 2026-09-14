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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { User } from './api'
import { ROLE_LABEL } from './role-label'

const FEATURES = [
  filtering({
    search: { id: 'usuarios-buscar', label: 'Buscar usuario', placeholder: 'Nombre o correo' },
  }),
  sorting(),
  pagination(),
]

export function UsersTable({
  users,
  currentUserId,
  onEdit,
  onToggleBanned,
  emptyAction,
}: {
  users: User[]
  currentUserId: string
  onEdit: (u: User) => void
  onToggleBanned: (u: User) => void
  emptyAction?: React.ReactNode
}) {
  const columns = useMemo(
    () =>
      defineColumns<User>((col) => [
        col.accessor('name', {
          header: 'Nombre',
          meta: { mobile: 'title' },
          cell: (c) => <span className="font-medium">{c.getValue()}</span>,
        }),
        col.accessor('email', {
          header: 'Correo',
          cell: (c) => <span className="font-mono text-sm">{c.getValue()}</span>,
          meta: { mobile: 'subtitle' },
        }),
        col.accessor('role', {
          header: 'Rol',
          // `c.getValue()` no tipa el valor (limitación de las features compuestas de TanStack en
          // el núcleo): se lee `c.row.original.role`, ya tipado como `UserRole`, en su lugar.
          cell: (c) => <Badge variant="outline">{ROLE_LABEL[c.row.original.role]}</Badge>,
          meta: { mobile: 'detail' },
          enableGlobalFilter: false,
        }),
        col.display({
          id: 'state',
          header: 'Estado',
          meta: { mobile: 'badge' },
          cell: (c) => {
            const u = c.row.original
            return u.banned ? (
              <Badge variant="destructive">Bloqueado</Badge>
            ) : (
              <ActiveBadge active />
            )
          },
        }),
        col.display({
          id: 'actions',
          header: '',
          meta: { mobile: 'actions', align: 'right' },
          cell: (c) => {
            const u = c.row.original
            const isSelf = u.id === currentUserId
            return (
              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar ${u.name}`}
                  onClick={() => onEdit(u)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSelf}
                  title={isSelf ? 'No puedes modificar tu propio acceso' : undefined}
                  onClick={() => onToggleBanned(u)}
                >
                  {u.banned ? 'Desbloquear' : 'Bloquear'}
                </Button>
              </div>
            )
          },
        }),
      ]),
    [currentUserId, onEdit, onToggleBanned],
  )
  const grid = useDataGrid({
    key: 'usuarios',
    columns,
    data: users,
    features: FEATURES,
    getRowId: (u) => u.id,
  })
  return (
    <DataGrid.Root
      grid={grid}
      emptyMessage={(q) =>
        q
          ? `Ningún usuario coincide con "${q}"`
          : 'Aún no hay usuarios. Crea el primero con Nuevo usuario.'
      }
      emptyAction={emptyAction}
    >
      <DataGrid.Toolbar />
      <DataGrid.Content />
      <DataGrid.Pagination />
    </DataGrid.Root>
  )
}
