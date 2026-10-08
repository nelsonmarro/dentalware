import { ACCOUNTS_ROLES, hasRole } from '@dentalware/shared'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

// «Cuentas» y la cuenta de cada clínica son de ACCOUNTS_ROLES (admin y recepción): técnico y
// mensajero vuelven al inicio, también si entran por URL a una ruta hija.
export const Route = createFileRoute('/_app/cuentas')({
  beforeLoad: ({ context }) => {
    if (!hasRole(ACCOUNTS_ROLES, context.user.role)) throw redirect({ to: '/' })
  },
  component: () => <Outlet />,
})
