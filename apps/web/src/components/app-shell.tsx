import type { UserRole } from '@dentalware/shared'
import { Link, useNavigate } from '@tanstack/react-router'
import { ClipboardList, Home, LogOut, Settings, Truck, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { authClient } from '@/features/auth/auth-client'

type NavItem = { to: string; label: string; icon: typeof Home; roles?: UserRole[] }

const NAV: NavItem[] = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/trabajos', label: 'Trabajos', icon: ClipboardList },
  { to: '/entregas', label: 'Entregas', icon: Truck },
  { to: '/cuentas', label: 'Cuentas', icon: Wallet, roles: ['admin', 'recepcion'] },
  { to: '/configuracion', label: 'Configuración', icon: Settings, roles: ['admin'] },
]

const NAV_LINK_BASE =
  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none'
const NAV_LINK_ACTIVE = 'bg-accent text-accent-foreground font-medium'
const NAV_LINK_INACTIVE = 'text-muted-foreground'

const BOTTOM_LINK_BASE =
  'flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none'
const BOTTOM_LINK_ACTIVE = 'text-primary font-medium'
const BOTTOM_LINK_INACTIVE = 'text-muted-foreground'

export function AppShell({
  user,
  children,
}: {
  user: { name: string; role: UserRole }
  children: ReactNode
}) {
  const navigate = useNavigate()
  const items = NAV.filter((i) => !i.roles || i.roles.includes(user.role))

  async function logout() {
    await authClient.signOut()
    await navigate({ to: '/login' })
  }

  return (
    <div className="flex min-h-svh bg-background text-foreground">
      {/* Sidebar PC */}
      <aside
        className="hidden w-60 shrink-0 flex-col border-r border-border bg-card lg:flex"
        data-testid="sidebar"
      >
        <div className="px-5 py-4 text-lg font-semibold">Dentalware</div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map((i) => (
            <Link
              key={i.to}
              to={i.to}
              className={NAV_LINK_BASE}
              activeProps={{ className: NAV_LINK_ACTIVE }}
              inactiveProps={{ className: NAV_LINK_INACTIVE }}
              activeOptions={{ exact: i.to === '/' }}
            >
              <i.icon className="size-4" /> {i.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
          <span className="truncate">{user.name}</span>
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Cerrar sesión">
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header móvil */}
        <header className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <span className="font-semibold">Dentalware</span>
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Cerrar sesión">
            <LogOut className="size-4" />
          </Button>
        </header>

        <main className="flex-1 p-4 pb-24 lg:p-8 lg:pb-8">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>

        {/* Barra inferior móvil */}
        <nav
          className="fixed inset-x-0 bottom-0 flex justify-around border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
          data-testid="bottom-nav"
        >
          {items.map((i) => (
            <Link
              key={i.to}
              to={i.to}
              className={BOTTOM_LINK_BASE}
              activeProps={{ className: BOTTOM_LINK_ACTIVE }}
              inactiveProps={{ className: BOTTOM_LINK_INACTIVE }}
              activeOptions={{ exact: i.to === '/' }}
            >
              <i.icon className="size-6" />
              {i.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
