import type { UseQueryResult } from '@tanstack/react-query'
import { LoadError } from '@/components/load-error'
import type { User } from './api'
import { UsersTable } from './users-table'

/**
 * Extraído de la ruta `configuracion/usuarios.tsx` (ronda de fixes 1, UX3-02, punto 3): mismo
 * criterio que `clinics-list.tsx`.
 */
export function UsersList({
  users,
  currentUserId,
  onEdit,
  onToggleBanned,
  emptyAction,
}: {
  users: UseQueryResult<User[]>
  currentUserId: string
  onEdit: (u: User) => void
  onToggleBanned: (u: User) => void
  emptyAction?: React.ReactNode
}) {
  if (users.isPending) return <p className="text-sm text-muted-foreground">Cargando…</p>
  if (users.isError) return <LoadError onRetry={() => void users.refetch()} />
  return (
    <UsersTable
      users={users.data ?? []}
      currentUserId={currentUserId}
      onEdit={onEdit}
      onToggleBanned={onToggleBanned}
      emptyAction={emptyAction}
    />
  )
}
