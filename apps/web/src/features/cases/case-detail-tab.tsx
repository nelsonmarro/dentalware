import {
  CHECKLIST_KEYS,
  CHECKLIST_LABEL,
  SHADE_SYSTEM_LABEL,
  type UserRole,
  hidesPrices,
} from '@dentalware/shared'
import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney } from '@/features/products/pricing-unit-label'
import { cn } from '@/lib/utils'
import type { CaseDetail } from './api'
import { Odontogram } from './odontogram'

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
 * internas (solo admin|recepción). Cada tarjeta titula con un `h2` (UX3-25). La fase, el
 * técnico y «Repetir» viven en `ProductionPanel`, sobre las pestañas (UX3-05). */
export function CaseDetailTab({
  case: c,
  hidePrices,
  role,
}: {
  case: CaseDetail
  hidePrices: boolean
  role: UserRole
}) {
  const canSeeInternal = !hidesPrices(role)
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>Líneas</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {c.items.map((item) => (
            <CaseLineRow key={item.id} item={item} hidePrices={hidePrices} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>Color y sistema</h2>
          </CardTitle>
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
          <CardTitle asChild>
            <h2>Lista de verificación</h2>
          </CardTitle>
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
            <CardTitle asChild>
              <h2>Observaciones</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{c.observations}</p>
          </CardContent>
        </Card>
      )}

      {c.prescription && (
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>Prescripción</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{c.prescription}</p>
          </CardContent>
        </Card>
      )}

      {canSeeInternal && c.internalNotes && (
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>Notas internas</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{c.internalNotes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
