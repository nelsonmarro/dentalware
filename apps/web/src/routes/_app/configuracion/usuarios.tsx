import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import type { User } from '@/features/users/api'
import { UserForm } from '@/features/users/user-form'
import { UsersTable } from '@/features/users/users-table'
import {
  useCreateUser,
  useSetUserBanned,
  useUpdateUser,
  useUsers,
} from '@/features/users/use-users'

export const Route = createFileRoute('/_app/configuracion/usuarios')({ component: UsersPage })

function UsersPage() {
  const { user: currentUser } = Route.useRouteContext()
  const [editing, setEditing] = useState<User | null | 'new'>(null)
  const [banTarget, setBanTarget] = useState<User | null>(null)
  const users = useUsers()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const setBanned = useSetUserBanned()

  const newButton = (
    <Button className="h-11" onClick={() => setEditing('new')}>
      <Plus className="size-4" /> Nuevo usuario
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuarios"
        description="Quién puede entrar y con qué permisos."
        action={newButton}
      />
      {users.isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <UsersTable
          users={users.data ?? []}
          currentUserId={currentUser.id}
          onEdit={setEditing}
          onToggleBanned={setBanTarget}
          emptyAction={newButton}
        />
      )}
      {editing !== null && (
        <UserForm
          key={editing === 'new' ? 'new' : editing.id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          user={editing === 'new' ? null : editing}
          currentUserId={currentUser.id}
          onCreate={(input) => createUser.mutate(input, { onSuccess: () => setEditing(null) })}
          onUpdate={(input) =>
            editing !== 'new' &&
            updateUser.mutate({ id: editing.id, input }, { onSuccess: () => setEditing(null) })
          }
          pending={createUser.isPending || updateUser.isPending}
        />
      )}
      {banTarget && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setBanTarget(null)}
          title={banTarget.banned ? 'Restablecer acceso' : 'Bloquear acceso'}
          description={
            banTarget.banned
              ? 'La persona podrá volver a iniciar sesión.'
              : 'La persona no podrá iniciar sesión y sus sesiones abiertas se cerrarán.'
          }
          confirmLabel={banTarget.banned ? 'Restablecer acceso' : 'Bloquear'}
          destructive={!banTarget.banned}
          pending={setBanned.isPending}
          onConfirm={() =>
            setBanned.mutate(
              { id: banTarget.id, banned: !banTarget.banned },
              { onSuccess: () => setBanTarget(null) },
            )
          }
        />
      )}
    </div>
  )
}
