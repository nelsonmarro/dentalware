import type { UserRole } from '@dentalware/shared'
import { CASE_NOTIFY_ROLES, SETTINGS_ROLES, caseWhatsappText, hasRole } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { ExternalLink, MessageCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { whatsappUrl } from '@/lib/map-link'
import type { CaseDetail } from './api'

/** «Avisar por WhatsApp» (AVI-4): abre WhatsApp con el aviso escrito; no envía nada por sí
 * solo. Solo para quien atiende a la clínica (`CASE_NOTIFY_ROLES`). Sin WhatsApp registrado,
 * dice cómo añadirlo: el admin, que edita clínicas, con un enlace al diálogo de esa clínica. */
export function CaseWhatsapp({
  case: c,
  role,
  labName,
  focus = false,
}: {
  case: CaseDetail
  role: UserRole
  labName: string | null
  /** Enfoca el enlace al montarse: se vuelve de añadir el WhatsApp con `?foco=whatsapp`. */
  focus?: boolean
}) {
  const linkRef = useRef<HTMLAnchorElement>(null)
  // React solo respeta `autoFocus` en controles de formulario: un `<a>` se enfoca a mano.
  // `c.clinic?.whatsapp` es dependencia a propósito: la ficha monta con la caché vieja sin número y solo su cambio relanza el foco.
  useEffect(() => {
    if (focus) linkRef.current?.focus()
  }, [focus, c.clinic?.whatsapp])
  if (!hasRole(CASE_NOTIFY_ROLES, role) || !c.clinic) return null
  const { clinic } = c
  if (!clinic.whatsapp) {
    return (
      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <MessageCircle aria-hidden className="size-4 shrink-0" />
          Sin WhatsApp registrado.
          {!hasRole(SETTINGS_ROLES, role) && ' Pídele al administrador que lo registre.'}
        </p>
        {hasRole(SETTINGS_ROLES, role) && (
          <Link
            to="/configuracion/clinicas"
            search={{ editar: clinic.id, volver: `/trabajos/${c.id}`, campo: 'whatsapp' }}
            className="inline-flex min-h-11 items-center self-start text-primary underline underline-offset-2"
          >
            Añadir WhatsApp
          </Link>
        )}
      </div>
    )
  }
  const text = caseWhatsappText({
    labName,
    code: c.code,
    patientRef: c.patientRef,
    status: c.status,
  })
  return (
    <Button asChild variant="outline" className="h-11 w-full sm:w-auto sm:self-start">
      <a
        ref={linkRef}
        href={whatsappUrl(clinic.whatsapp, text)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Avisar por WhatsApp a ${clinic.name} (abre WhatsApp)`}
      >
        <MessageCircle aria-hidden />
        Avisar por WhatsApp
        <ExternalLink aria-hidden className="size-3.5 opacity-70" />
      </a>
    </Button>
  )
}
