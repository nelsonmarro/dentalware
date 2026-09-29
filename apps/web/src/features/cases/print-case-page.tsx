import type { UserRole } from '@dentalware/shared'
import { hidesPrices } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { useLabSettings } from '@/features/config/use-lab-settings'
import { getPublicUrl } from '@/lib/public-url'
import { PrintOrder } from './print-order'
import { useCase } from './use-cases'

/**
 * Pantalla de la orden imprimible (FIC-1, #71): trabajo con esa lógica que antes vivía dentro
 * del archivo de ruta (`routes/_app/trabajos/$caseId_.imprimir.tsx`). Se movió a `features/`
 * (ronda de fixes 1, Tarea 14) para que fuera testeable sin montar el árbol de rutas completo
 * (`Route.useParams()`/`useRouteContext()` no hacen falta aquí: el archivo de ruta se los pasa
 * ya resueltos como props) — I-3, «test de la ruta de impresión».
 *
 * `hidesPrices(role)` es la misma regla de `@dentalware/shared` que usa la API (ADR 31): antes
 * esta pantalla repetía `role === 'tecnico' || role === 'mensajero'` a mano, la quinta copia sin
 * test propio.
 */
export function PrintCasePage({ caseId, role }: { caseId: string; role: UserRole }) {
  const detail = useCase(caseId)
  const settings = useLabSettings()

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
      {/* M-6: enlace de vuelta junto al botón de imprimir — antes solo existía en la pantalla
       * de error, así que abrir la orden por error o cambiar de opinión no tenía salida sin
       * usar el botón "atrás" del navegador. */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Button variant="outline" asChild className="h-11">
          <Link to="/trabajos/$caseId" params={{ caseId }}>
            Volver al trabajo
          </Link>
        </Button>
        <Button onClick={() => window.print()} className="h-11">
          <Printer /> Imprimir
        </Button>
      </div>
      <PrintOrder
        case={detail.data.case}
        settings={settings.data}
        hidePrices={hidesPrices(role)}
        publicUrl={getPublicUrl()}
      />
    </div>
  )
}
