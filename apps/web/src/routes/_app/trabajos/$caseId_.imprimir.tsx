import { createFileRoute, Link } from '@tanstack/react-router'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { useLabSettings } from '@/features/config/use-lab-settings'
import { PrintOrder } from '@/features/cases/print-order'
import { useCase } from '@/features/cases/use-cases'

// `_` antes de `.imprimir`, igual que `$caseId_.editar.tsx`: sin él, TanStack Router anida esta
// ruta bajo `$caseId.tsx` (la ficha, sin `<Outlet />`) y nunca se vería. El `_` la deja
// independiente en `/trabajos/$caseId/imprimir`.
export const Route = createFileRoute('/_app/trabajos/$caseId_/imprimir')({
  component: PrintCasePage,
})

function PrintCasePage() {
  const { caseId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const detail = useCase(caseId)
  const settings = useLabSettings()
  const hidePrices = user.role === 'tecnico' || user.role === 'mensajero'

  if (detail.isPending || settings.isPending) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>
  }
  if (detail.isError || !detail.data || settings.isError || !settings.data) {
    return (
      <EmptyState
        title="No se pudo cargar la orden"
        action={
          <Button asChild>
            <Link to="/trabajos/$caseId" params={{ caseId }}>
              Volver al trabajo
            </Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end print:hidden">
        <Button onClick={() => window.print()} className="h-11">
          <Printer /> Imprimir
        </Button>
      </div>
      <PrintOrder case={detail.data.case} settings={settings.data} hidePrices={hidePrices} />
    </div>
  )
}
