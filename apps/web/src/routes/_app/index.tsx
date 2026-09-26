import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/page-header'
import { HomeSummary } from '@/features/cases/home-summary'
import { useHealth } from '@/features/health/use-health'

export const Route = createFileRoute('/_app/')({
  component: HomePage,
})

/**
 * Panel de inicio (INI-1 + INI-2, Tarea 12). La ruta solo compone (`docs/architecture.md`
 * §3.3): quién ve qué según el rol (M-4, ronda de fixes 1) es responsabilidad de
 * `<HomeSummary />` (feature `cases`, con su propio test), no de esta ruta.
 */
function HomePage() {
  const { user } = Route.useRouteContext()
  const health = useHealth()
  const status = health.isPending ? 'comprobando…' : health.data?.ok ? 'conectada' : 'sin conexión'
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Inicio" description={`Bienvenido, ${user.name}`} />
      <HomeSummary role={user.role} technicianId={user.id} />
      {/* Estado del servidor: se conserva (login.spec.ts lo comprueba) en un sitio discreto,
          al pie del panel en vez de bajo el título (ruling PR 2, T12, punto 5). */}
      <p className="text-xs text-muted-foreground">
        Estado del servidor:{' '}
        <span className="font-mono" data-testid="api-status">
          API: {status}
        </span>
      </p>
    </div>
  )
}
