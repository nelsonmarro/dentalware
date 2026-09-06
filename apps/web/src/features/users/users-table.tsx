import { Pencil } from 'lucide-react'
import { ActiveBadge } from '@/components/active-badge'
import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { User } from './api'
import { ROLE_LABEL } from './role-label'

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
  const actions = (u: User) => {
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
  }
  return (
    <DataTable
      rows={users}
      getRowId={(u) => u.id}
      emptyMessage="Aún no hay usuarios. Crea el primero con Nuevo usuario."
      emptyAction={emptyAction}
      columns={[
        {
          key: 'name',
          header: 'Nombre',
          cell: (u) => <span className="font-medium">{u.name}</span>,
        },
        {
          key: 'email',
          header: 'Correo',
          cell: (u) => <span className="font-mono text-sm">{u.email}</span>,
        },
        {
          key: 'role',
          header: 'Rol',
          cell: (u) => <Badge variant="outline">{ROLE_LABEL[u.role]}</Badge>,
        },
        {
          key: 'state',
          header: 'Estado',
          cell: (u) =>
            u.banned ? <Badge variant="destructive">Bloqueado</Badge> : <ActiveBadge active />,
        },
        { key: 'actions', header: '', cell: actions, className: 'text-right' },
      ]}
      renderMobile={(u) => (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="font-medium">{u.name}</span>
              <Badge variant="outline" className="w-fit">
                {ROLE_LABEL[u.role]}
              </Badge>
            </div>
            {u.banned ? <Badge variant="destructive">Bloqueado</Badge> : <ActiveBadge active />}
          </div>
          <p className="font-mono text-sm text-muted-foreground">{u.email}</p>
          {actions(u)}
        </div>
      )}
    />
  )
}
