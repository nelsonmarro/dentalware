import { hasRole, SETTINGS_ROLES } from '@dentalware/shared'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { ConfigNav } from '@/features/config/config-nav'

export const Route = createFileRoute('/_app/configuracion')({
  beforeLoad: ({ context }) => {
    if (!hasRole(SETTINGS_ROLES, context.user.role)) throw redirect({ to: '/' })
  },
  component: ConfigLayout,
})

function ConfigLayout() {
  return (
    <div className="flex flex-col gap-6">
      <ConfigNav />
      <Outlet />
    </div>
  )
}
