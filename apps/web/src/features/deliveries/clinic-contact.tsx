import { MapPin, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { mapUrl, telUrl } from './map-link'

/**
 * Cómo llegar a la clínica y cómo llamarla (ENT-5): la dirección abre el mapa en otra pestaña y
 * el teléfono llama, como botones de 44 px para tocarlos con guantes. Lo comparten la parada de
 * la ruta (`ClinicGroup`) y la ficha corta del mensajero (UX4-07). Sin dirección ni teléfono no
 * monta nada.
 */
export function ClinicContact({
  clinic,
}: {
  clinic: { address: string | null; phone: string | null }
}) {
  if (!clinic.address && !clinic.phone) return null
  return (
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
  )
}
