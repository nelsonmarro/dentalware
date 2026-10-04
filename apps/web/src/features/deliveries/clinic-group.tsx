import type { UserRole } from '@dentalware/shared'
import { MapPin, Phone } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import type { DeliveryItem } from './api'
import { DeliveryCard } from './delivery-card'
import { mapUrl, telUrl } from './map-link'

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
      {(clinic.address || clinic.phone) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {clinic.address && (
            <Button
              asChild
              variant="outline"
              className="h-auto min-h-11 justify-start py-2 text-left whitespace-normal"
            >
              <a href={mapUrl(clinic.address)} target="_blank" rel="noreferrer">
                <MapPin aria-hidden />
                <span className="min-w-0 break-words">{clinic.address}</span>
              </a>
            </Button>
          )}
          {clinic.phone && (
            <Button asChild variant="outline" className="justify-start">
              <a href={telUrl(clinic.phone)}>
                <Phone aria-hidden />
                <span className="font-mono">{clinic.phone}</span>
              </a>
            </Button>
          )}
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {deliveries.map((d) => (
          <DeliveryCard key={d.id} delivery={d} role={role} userId={userId} today={today} />
        ))}
      </ul>
    </section>
  )
}
