import { toIsoDate } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { DeliveriesDay } from './deliveries-day'

/**
 * «Entregas de hoy» del inicio del mensajero (INI-3, #105): su ruta del día agrupada por
 * clínica, compacta (solo lo pendiente, incluidas las atrasadas), con las mismas acciones que
 * «Entregas» y un enlace a la pantalla completa. Sustituye a los contadores del laboratorio,
 * que al mensajero no le dicen qué hacer. La API ya le devuelve solo las suyas.
 */
export function MyDeliveriesToday({ userId }: { userId: string }) {
  const today = toIsoDate(new Date())
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-medium">Entregas de hoy</h2>
        <Link
          to="/entregas"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Ver todas
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
      <DeliveriesDay day={today} role="mensajero" userId={userId} compact />
    </section>
  )
}
