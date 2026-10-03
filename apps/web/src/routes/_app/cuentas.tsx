import { ACCOUNTS_ROLES, hasRole } from '@dentalware/shared'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cuentas')({
  beforeLoad: ({ context }) => {
    if (!hasRole(ACCOUNTS_ROLES, context.user.role)) throw redirect({ to: '/' })
  },
  component: () => <h1 className="text-2xl font-semibold">Cuentas</h1>,
})
