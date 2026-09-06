import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { ConfigNav } from '@/features/config/config-nav'

export const Route = createFileRoute('/_app/configuracion')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'admin') throw redirect({ to: '/' })
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
