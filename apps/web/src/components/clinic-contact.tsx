import { ExternalLink, MapPin, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { mapPlace, mapUrl, telUrl } from '@/lib/map-link'

/**
 * Cómo llegar a la clínica y cómo llamarla (ENT-5): la dirección abre el mapa en otra pestaña y
 * el teléfono llama, como botones de 44 px para tocarlos con guantes. Lo comparten la parada de
 * la ruta (`ClinicGroup`, «Entregas») y la ficha corta del mensajero (UX4-07), por eso vive en
 * `components/`.
 *
 * UX4-21: el mapa busca la dirección en su ciudad, y el enlace dice (con texto accesible y el
 * icono de enlace externo) que sale de la app. Sin dirección lo dice: callar parecía un fallo.
 */
export function ClinicContact({
  clinic,
}: {
  clinic: { address: string | null; city: string | null; phone: string | null }
}) {
  const place = clinic.address ? mapPlace(clinic.address, clinic.city) : null
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {place ? (
        <Button
          asChild
          variant="outline"
          className="h-auto min-h-11 justify-start py-2 text-left whitespace-normal"
        >
          <a
            href={mapUrl(clinic.address ?? '', clinic.city)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir en el mapa: ${place} (se abre en otra pestaña)`}
          >
            <MapPin aria-hidden />
            <span className="min-w-0 break-words">{place}</span>
            <ExternalLink aria-hidden className="ml-auto size-3.5 shrink-0 opacity-70" />
          </a>
        </Button>
      ) : (
        <p className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
          <MapPin aria-hidden className="size-4" />
          Sin dirección registrada
        </p>
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
