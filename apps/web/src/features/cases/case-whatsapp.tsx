import type { UserRole } from '@dentalware/shared'
import { CASE_NOTIFY_ROLES, SETTINGS_ROLES, caseWhatsappText, hasRole } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { ExternalLink, MessageCircle } from 'lucide-react'
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
}: {
  case: CaseDetail
  role: UserRole
  labName: string | null
}) {
  if (!hasRole(CASE_NOTIFY_ROLES, role) || !c.clinic) return null
  const { clinic } = c
  if (!clinic.whatsapp) {
    return (
      <p className="text-sm text-muted-foreground">
        {clinic.name} no tiene WhatsApp registrado.{' '}
        {hasRole(SETTINGS_ROLES, role) ? (
          <Link
            to="/configuracion/clinicas"
            search={{ editar: clinic.id }}
            className="inline-flex min-h-11 items-center text-primary underline underline-offset-2"
          >
            Añadirlo
          </Link>
        ) : (
          'Pídele al administrador que lo añada en Configuración › Clínicas.'
        )}
      </p>
    )
  }
  const text = caseWhatsappText({
    labName,
    code: c.code,
    patientRef: c.patientRef,
    status: c.status,
  })
  return (
    <Button asChild variant="outline" className="h-11 self-start">
      <a
        href={whatsappUrl(clinic.whatsapp, text)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Avisar por WhatsApp a ${clinic.name} (se abre en otra pestaña)`}
      >
        <MessageCircle aria-hidden />
        Avisar por WhatsApp
        <ExternalLink aria-hidden className="size-3.5 opacity-70" />
      </a>
    </Button>
  )
}
