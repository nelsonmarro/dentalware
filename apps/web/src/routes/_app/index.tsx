import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/page-header'
import { MyCases } from '@/features/cases/my-cases'
import { SummaryCards } from '@/features/cases/summary-cards'
import { useHealth } from '@/features/health/use-health'

export const Route = createFileRoute('/_app/')({
  component: HomePage,
})

/**
 * Panel de inicio (INI-1 + INI-2, Tarea 12). La ruta solo compone (`docs/architecture.md`
 * §3.3): `<SummaryCards />` y `<MyCases />` traen su propio dato con `useSummary`/`useCases`,
 * aquí solo se decide **quién** ve qué según el rol de `Route.useRouteContext()`.
 *
 * Contadores para todos los roles con sesión (admin, recepción, técnico y también mensajero:
 * ruling PR 2, T12 — su propia lista es INI-3, Iteración 4, fuera de esta tarea). «Mis
 * trabajos» solo para técnico (INI-2, tercer criterio de aceptación de CIC-5).
 */
function HomePage() {
  const { user } = Route.useRouteContext()
  const health = useHealth()
  const status = health.isPending ? 'comprobando…' : health.data?.ok ? 'conectada' : 'sin conexión'
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Inicio" description={`Bienvenido, ${user.name}`} />
      <SummaryCards />
      {user.role === 'tecnico' && <MyCases technicianId={user.id} />}
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
