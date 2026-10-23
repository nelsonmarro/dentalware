import type { UserRole } from '@dentalware/shared'
import { hidesPrices, isEditableStatus, canWriteCases } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { Pencil, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CaseAccountLine } from '@/features/accounts/case-account-line'
import { formatMoney } from '@/lib/format-money'
import type { CaseDetail, CaseEvent } from './api'
import { formatDate, formatTimestampDate } from './date-format'
import { CaseWhatsapp } from './case-whatsapp'
import { STATUS_COLOR, StatusChip } from './status-chip'

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

/** Cabecera de la ficha: pestaña de color del estado, código, chip, prioridad, clínica
 * y doctor, datos del paciente, fechas, total (según rol) — la fase y el técnico van en el
 * panel «Producción» justo debajo, no aquí (UX3-18) —,
 * el enlace al padre si es una repetición, el aviso de espera y el de datos faltantes
 * para aceptar el trabajo. */
export function CaseHeader({
  case: c,
  missing,
  role,
  events = [],
  remakes = [],
  labName = null,
  focusWhatsapp = false,
}: {
  case: CaseDetail
  missing: string[]
  role: UserRole
  /** Eventos del trabajo (I-1, ola de fixes del PR 1): solo se usan para la fecha del último
   * "hold" del aviso "En espera desde…". Opcional porque no todo llamador los tiene a mano
   * (los tests de este componente no cargan `/eventos`). */
  events?: CaseEvent[]
  /** Repeticiones directas del trabajo (`useCaseRemakes`, la misma consulta del bloque
   * «Repeticiones»): solo código e id, para avisar «Repetido: …» sin bajar al final de «Detalle»
   * (UX4-25). El detalle (estado, fecha, motivo) sigue en el bloque. */
  remakes?: { id: string; code: string }[]
  /** Nombre del laboratorio para el aviso por WhatsApp (AVI-4); `null` mientras no carga. */
  labName?: string | null
  /** Enfoca «Avisar por WhatsApp» al montar (`?foco=whatsapp`, de vuelta de añadirlo). */
  focusWhatsapp?: boolean
}) {
  const hidePrices = hidesPrices(role)
  const canEdit = canWriteCases(role) && isEditableStatus(c.status)
  const patient = [
    c.patientRef,
    c.patientAge !== null ? `${c.patientAge} años` : null,
    c.patientSex === 'M' ? 'Masculino' : c.patientSex === 'F' ? 'Femenino' : null,
  ]
    .filter(Boolean)
    .join(', ')
  // Último evento "hold" (CIC-3): el motivo obligatorio de la pausa ya viaja en
  // `c.holdReason`, pero "desde cuándo" solo está en el historial — no hay otro campo que lo
  // guarde (`applyTransition` no toca `updatedAt` con una fecha de negocio propia para esto).
  const lastHold =
    c.status === 'en_espera' ? [...events].reverse().find((e) => e.type === 'hold') : undefined

  return (
    // UX8-12: región y grupo con nombre, para que los lectores de pantalla (y las capturas del
    // manual) los encuentren por rol. La región se nombra por lo que reúne, no por el código: el
    // `h1` ya lo anuncia.
    <Card
      role="region"
      aria-label="Datos del trabajo"
      className="border-l-4"
      style={{ borderLeftColor: STATUS_COLOR[c.status] }}
    >
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div
            role="group"
            aria-label="Código, clínica y aviso"
            className="flex w-full flex-col gap-1 sm:w-auto"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold">{c.code}</h1>
              <StatusChip status={c.status} />
              {c.priority === 'urgente' && <Badge variant="destructive">Urgente</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {c.clinic?.name ?? '—'} · {c.doctor?.name ?? '—'}
            </p>
            <CaseWhatsapp case={c} role={role} labName={labName} focus={focusWhatsapp} />
            {/* I-2: CIC-4 exige que la repetición quede enlazada en la ficha del hijo, no solo
             * en `parentCaseId` (sin código ni enlace, invisible para quien la ve). */}
            {c.parentCaseId && c.parentCase && (
              <Link
                to="/trabajos/$caseId"
                params={{ caseId: c.parentCaseId }}
                className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-2"
              >
                Repetición de {c.parentCase.code}
              </Link>
            )}
            {remakes.length > 0 && (
              <div className="flex flex-wrap gap-x-4">
                {remakes.map((r) => (
                  <Link
                    key={r.id}
                    to="/trabajos/$caseId"
                    params={{ caseId: r.id }}
                    className="inline-flex min-h-11 items-center gap-1.5 text-sm text-primary underline underline-offset-2"
                  >
                    <span>Repetido:</span> <span className="font-mono">{r.code}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button asChild variant="outline" className="h-11 flex-1 sm:flex-none">
              <Link to="/trabajos/$caseId/imprimir" params={{ caseId: c.id }}>
                <Printer /> Imprimir
              </Link>
            </Button>
            {canEdit && (
              <Button asChild variant="outline" className="h-11 flex-1 sm:flex-none">
                <Link to="/trabajos/$caseId/editar" params={{ caseId: c.id }}>
                  <Pencil /> Editar
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Paciente" value={patient} />
          <Field label="Ingreso" value={formatDate(c.receivedAt)} />
          <Field label="Deseada" value={formatDate(c.dueDate)} />
          <Field label="Comprometida" value={formatDate(c.promisedDate)} />
          {!hidePrices && (
            <Field
              label="Total"
              value={<span className="font-mono">{formatMoney(c.total)}</span>}
            />
          )}
        </div>

        {/* Iteración 5: cuánto falta por cobrar de este trabajo, o cuándo se cobró. */}
        {c.clinic && (
          <CaseAccountLine
            account={c.account}
            clinicId={c.clinic.id}
            total={c.total}
            remakeChargePct={c.remakeChargePct}
            role={role}
          />
        )}

        {c.status === 'en_espera' && (
          <p className="rounded-lg border border-[color:var(--wax-amber)]/40 bg-[color:var(--wax-amber)]/10 px-3 py-2 text-sm text-[color:var(--wax-amber-ink)]">
            {/* Sin el evento `hold` todavía cargado no se inventa una fecha con `updatedAt`
             * (puede ser otra modificación posterior): se dice solo el motivo. */}
            {lastHold ? `En espera desde ${formatTimestampDate(lastHold.createdAt)}` : 'En espera'}
            {c.holdReason ? `: ${c.holdReason}` : ''}
          </p>
        )}

        {missing.length > 0 && (
          <p className="rounded-lg border border-[color:var(--wax-amber)]/40 bg-[color:var(--wax-amber)]/10 px-3 py-2 text-sm text-[color:var(--wax-amber-ink)]">
            Para aceptar falta: {missing.join(', ')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
