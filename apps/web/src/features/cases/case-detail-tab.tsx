import {
  CHECKLIST_KEYS,
  CHECKLIST_LABEL,
  REMAKE_ROLES,
  SHADE_SYSTEM_LABEL,
  type UserRole,
} from '@dentalware/shared'
import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Stage } from '@/features/stages/api'
import { formatMoney } from '@/features/products/pricing-unit-label'
import { cn } from '@/lib/utils'
import type { CaseDetail } from './api'
import { Odontogram } from './odontogram'
import { RemakeDialog } from './remake-dialog'
import { StageControl } from './stage-control'
import { TechnicianSelect } from './technician-select'

function money(value: string | null) {
  return value === null ? '—' : formatMoney(value)
}

function ChecklistChip({ label, checked }: { label: string; checked: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm',
        checked
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border bg-muted text-muted-foreground',
      )}
    >
      {checked ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
      {label}
    </span>
  )
}

function LineField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-sm', mono && 'font-mono')}>{value}</span>
    </div>
  )
}

function CaseLineRow({
  item,
  hidePrices,
}: {
  item: CaseDetail['items'][number]
  hidePrices: boolean
}) {
  return (
    <div
      data-testid="case-detail-line"
      className="flex flex-col gap-3 rounded-lg border border-border p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-medium">{item.product?.name}</p>
          {item.material && <p className="text-sm text-muted-foreground">{item.material}</p>}
          {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-4">
          <LineField label="Cantidad" value={item.quantity} />
          {!hidePrices && <LineField label="Precio" value={money(item.unitPrice)} mono />}
          {!hidePrices && (
            <LineField
              label="Descuento"
              value={Number(item.discountPct ?? 0) > 0 ? `${Number(item.discountPct)} %` : '—'}
            />
          )}
          {!hidePrices && <LineField label="Total" value={money(item.lineTotal)} mono />}
        </div>
      </div>
      {item.teeth.length > 0 && <Odontogram value={item.teeth} readOnly size="sm" />}
    </div>
  )
}

/** Pestaña "Detalle": líneas del trabajo (con odontograma de solo lectura por línea),
 * color/sistema/referencia, lista de verificación, observaciones, prescripción y notas
 * internas (solo admin|recepción). */
export function CaseDetailTab({
  case: c,
  hidePrices,
  role,
  stages = [],
  onRemakeCreated,
}: {
  case: CaseDetail
  hidePrices: boolean
  role: UserRole
  /** Fases (todas, activas o no: `STAGE_CHANGE_BLOCKED_REASON`/`current?.name` en `StageControl`
   * necesitan resolver el nombre aunque la fase actual se haya desactivado después). Vacío
   * por defecto: un trabajo sin fase (`currentStageId: null`) no necesita la lista. */
  stages?: Stage[]
  /** Adónde ir tras crear una repetición (Tarea 9): el hijo puede nacer incompleto, así que
   * quien monta esta pestaña navega a su ficha en vez de quedarse en la del padre. */
  onRemakeCreated?: (created: CaseDetail) => void
}) {
  const canSeeInternal = role === 'admin' || role === 'recepcion'
  return (
    <div className="flex flex-col gap-6">
      <StageControl case={c} stages={stages} role={role} />

      <Card>
        <CardContent>
          <TechnicianSelect case={c} role={role} />
        </CardContent>
      </Card>

      {(REMAKE_ROLES as readonly UserRole[]).includes(role) && (
        <div className="flex justify-end">
          <RemakeDialog case={c} onCreated={onRemakeCreated} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Líneas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {c.items.map((item) => (
            <CaseLineRow key={item.id} item={item} hidePrices={hidePrices} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Color y sistema</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Color</p>
            <p className="text-sm">{c.shade || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sistema</p>
            <p className="text-sm">{c.shadeSystem ? SHADE_SYSTEM_LABEL[c.shadeSystem] : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Referencia</p>
            <p className="text-sm">{c.reference || '—'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de verificación</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {CHECKLIST_KEYS.map((key) => (
            <ChecklistChip key={key} label={CHECKLIST_LABEL[key]} checked={c.checklist[key]} />
          ))}
        </CardContent>
      </Card>

      {c.observations && (
        <Card>
          <CardHeader>
            <CardTitle>Observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{c.observations}</p>
          </CardContent>
        </Card>
      )}

      {c.prescription && (
        <Card>
          <CardHeader>
            <CardTitle>Prescripción</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{c.prescription}</p>
          </CardContent>
        </Card>
      )}

      {canSeeInternal && c.internalNotes && (
        <Card>
          <CardHeader>
            <CardTitle>Notas internas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{c.internalNotes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
