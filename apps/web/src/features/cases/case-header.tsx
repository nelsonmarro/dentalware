import type { CaseStatus, UserRole } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatMoney } from '@/features/products/pricing-unit-label'
import type { CaseDetail } from './api'
import { formatDate } from './date-format'
import { STATUS_COLOR, StatusChip } from './status-chip'

// Debe reflejar `EDITABLE` en `apps/api/src/features/cases/repo.ts`.
const EDITABLE: readonly CaseStatus[] = ['nuevo', 'en_proceso']

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

/** Cabecera de la ficha: pestaña de color del estado, código, chip, prioridad, clínica
 * y doctor, datos del paciente, fechas, técnico/fase si existen, total (según rol) y
 * el aviso de datos faltantes para aceptar el trabajo. */
export function CaseHeader({
  case: c,
  missing,
  role,
}: {
  case: CaseDetail
  missing: string[]
  role: UserRole
}) {
  const hidePrices = role === 'tecnico' || role === 'mensajero'
  const canEdit = (role === 'admin' || role === 'recepcion') && EDITABLE.includes(c.status)
  const patient = [
    c.patientRef,
    c.patientAge !== null ? `${c.patientAge} años` : null,
    c.patientSex === 'M' ? 'Masculino' : c.patientSex === 'F' ? 'Femenino' : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <Card className="border-l-4" style={{ borderLeftColor: STATUS_COLOR[c.status] }}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-2xl font-semibold">{c.code}</span>
              <StatusChip status={c.status} />
              {c.priority === 'urgente' && <Badge variant="destructive">Urgente</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {c.clinic?.name ?? '—'} · {c.doctor?.name ?? '—'}
            </p>
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
          {c.stage && <Field label="Fase" value={c.stage.name} />}
          {!hidePrices && (
            <Field
              label="Total"
              value={<span className="font-mono">{formatMoney(c.total)}</span>}
            />
          )}
        </div>

        {missing.length > 0 && (
          <p className="rounded-lg border border-[color:var(--wax-amber)]/40 bg-[color:var(--wax-amber)]/10 px-3 py-2 text-sm text-[color:var(--wax-amber)]">
            Para aceptar falta: {missing.join(', ')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
