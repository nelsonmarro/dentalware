import type { UserRole } from '@dentalware/shared'
import { useId } from 'react'
import type { DeliveryItem } from './api'
import { ClinicContact } from './clinic-contact'
import { DeliveryCard } from './delivery-card'

/**
 * Una parada de la ruta (ENT-5): la clínica con su dirección (abre el mapa en otra pestaña) y
 * su teléfono (llama), como botones de 44 px para tocarlos con guantes, y debajo sus recogidas
 * y entregas del día. `region` con el nombre de la clínica: el lector de pantalla salta de
 * parada en parada.
 */
export function ClinicGroup({
  clinic,
  deliveries,
  role,
  userId,
  today,
}: {
  clinic: DeliveryItem['clinic']
  deliveries: DeliveryItem[]
  role: UserRole
  userId: string
  today: string
}) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-3 rounded-xl border-t-4 border-t-primary bg-card p-4 ring-1 ring-foreground/10"
    >
      <h2 id={titleId} className="font-heading text-lg leading-tight font-semibold">
        {clinic.name}
      </h2>
      <ClinicContact clinic={clinic} />
      <ul className="flex flex-col gap-2">
        {deliveries.map((d) => (
          <DeliveryCard key={d.id} delivery={d} role={role} userId={userId} today={today} />
        ))}
      </ul>
    </section>
  )
}
