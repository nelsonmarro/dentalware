import type { UserRole } from '@dentalware/shared'
import { isEditableStatus } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatMoney } from '@/features/products/pricing-unit-label'
import type { CaseDetail, CaseEvent } from './api'
import { isStageVisible } from './case-views'
import { formatDate, formatTimestampDate } from './date-format'
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
 * y doctor, datos del paciente, fechas, técnico/fase si existen, total (según rol),
 * el enlace al padre si es una repetición, el aviso de espera y el de datos faltantes
 * para aceptar el trabajo. */
export function CaseHeader({
  case: c,
  missing,
  role,
  events = [],
}: {
  case: CaseDetail
  missing: string[]
  role: UserRole
  /** Eventos del trabajo (I-1, ola de fixes del PR 1): solo se usan para la fecha del último
   * "hold" del aviso "En espera desde…". Opcional porque no todo llamador los tiene a mano
   * (los tests de este componente no cargan `/eventos`). */
  events?: CaseEvent[]
}) {
  const hidePrices = role === 'tecnico' || role === 'mensajero'
  const canEdit = (role === 'admin' || role === 'recepcion') && isEditableStatus(c.status)
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
    <Card className="border-l-4" style={{ borderLeftColor: STATUS_COLOR[c.status] }}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold">{c.code}</h1>
              <StatusChip status={c.status} />
              {c.priority === 'urgente' && <Badge variant="destructive">Urgente</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {c.clinic?.name ?? '—'} · {c.doctor?.name ?? '—'}
            </p>
            {/* I-2: CIC-4 exige que la repetición quede enlazada en la ficha del hijo, no solo
             * en `parentCaseId` (sin código ni enlace, invisible para quien la ve). */}
            {c.parentCaseId && c.parentCase && (
              <Link
                to="/trabajos/$caseId"
                params={{ caseId: c.parentCaseId }}
                className="text-sm text-primary underline underline-offset-2"
              >
                Repetición de {c.parentCase.code}
              </Link>
            )}
          </div>
          {canEdit && (
            <Button asChild variant="outline" className="h-11">
              <Link to="/trabajos/$caseId/editar" params={{ caseId: c.id }}>
                <Pencil /> Editar
              </Link>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Paciente" value={patient} />
          <Field label="Ingreso" value={formatDate(c.receivedAt)} />
          <Field label="Deseada" value={formatDate(c.dueDate)} />
          <Field label="Comprometida" value={formatDate(c.promisedDate)} />
          {c.technician && <Field label="Técnico" value={c.technician.name} />}
          {c.stage && isStageVisible(c.status) && <Field label="Fase" value={c.stage.name} />}
          {!hidePrices && (
            <Field
              label="Total"
              value={<span className="font-mono">{formatMoney(c.total)}</span>}
            />
          )}
        </div>

        {c.status === 'en_espera' && (
          <p className="rounded-lg border border-[color:var(--wax-amber)]/40 bg-[color:var(--wax-amber)]/10 px-3 py-2 text-sm text-[color:var(--wax-amber)]">
            {/* Sin el evento `hold` todavía cargado no se inventa una fecha con `updatedAt`
             * (puede ser otra modificación posterior): se dice solo el motivo. */}
            {lastHold ? `En espera desde ${formatTimestampDate(lastHold.createdAt)}` : 'En espera'}
            {c.holdReason ? `: ${c.holdReason}` : ''}
          </p>
        )}

        {missing.length > 0 && (
          <p className="rounded-lg border border-[color:var(--wax-amber)]/40 bg-[color:var(--wax-amber)]/10 px-3 py-2 text-sm text-[color:var(--wax-amber)]">
            Para aceptar falta: {missing.join(', ')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
