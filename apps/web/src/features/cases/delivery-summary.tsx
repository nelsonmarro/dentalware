import {
  deliveredLine,
  pendingDeliveryLine,
  toIsoDate,
  type LastDelivered,
  type PendingDelivery,
} from '@dentalware/shared'
import { PackageCheck, Truck } from 'lucide-react'
import { attachmentUrl } from './attachments-api'
import { dayPhrase, formatTimestampDate } from './date-format'

/**
 * La recogida o entrega del trabajo en una línea (UX4-09): «Recogida programada para hoy con
 * Mario», «Sale el 09/10/2026 con Mario» o «Entregado el 04/10/2026 por Mario · Ver constancia».
 * Así recepción contesta a la clínica sin leer el historial. La pendiente manda: un trabajo
 * entregado ya no tiene ninguna. Sin nada que decir no monta nada.
 */
export function DeliverySummary({
  pending,
  lastDelivered,
}: {
  pending: PendingDelivery | null
  lastDelivered: LastDelivered | null
}) {
  if (pending) {
    const when = dayPhrase(pending.scheduledFor, toIsoDate(new Date()))
    return (
      <p className="flex items-start gap-2 text-base">
        <Truck aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          {pendingDeliveryLine(pending.type, when, pending.courierName)}
        </span>
      </p>
    )
  }
  if (!lastDelivered) return null
  return (
    <p className="flex items-start gap-2 text-base">
      <PackageCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      {/* Texto y enlace en un mismo bloque en línea: en móvil parten juntos, sin dejar el
          icono o el «·» solos en una línea. */}
      <span className="min-w-0">
        <span>
          {deliveredLine(formatTimestampDate(lastDelivered.doneAt), lastDelivered.courierName)}
        </span>
        {lastDelivered.proofAttachmentId && (
          <>
            <span aria-hidden className="text-muted-foreground">
              {' · '}
            </span>
            {/* Mismo enlace que «Ver constancia» del historial (UX4-16): la foto se abre aparte. */}
            <a
              href={attachmentUrl(lastDelivered.proofAttachmentId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center align-middle text-primary underline underline-offset-2"
            >
              Ver constancia
            </a>
          </>
        )}
      </span>
    </p>
  )
}
