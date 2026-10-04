import { canChangeStage, type UserRole } from '@dentalware/shared'
import { useId } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Stage } from '@/features/stages/api'
import { cn } from '@/lib/utils'
import type { CaseDetail } from './api'
import { CaseActions } from './case-actions'
import { DeliverySummary } from './delivery-summary'
import type { DeliverySelf } from './ship-dialog'
import { isStageVisible } from './case-views'
import { StageControl } from './stage-control'
import { stageNavigation } from './stage-navigation'
import { TechnicianSelect } from './technician-select'

/**
 * Panel «Producción» de la ficha (UX3-05), bajo la cabecera y antes de las pestañas: la fase
 * con «Avanzar»/«Retroceder», el técnico responsable y la barra de acciones de estado (con
 * «Repetir»), juntos y alcanzables desde cualquier pestaña — antes la fase, el técnico y
 * «Repetir» vivían dentro de «Detalle» y desde «Historial» no se podía avanzar.
 *
 * Un solo primario por contexto (UX3-04): mientras haya fase siguiente el primario es
 * «Avanzar fase» y «Finalizar» queda en secundario; en la última fase «Finalizar» es el
 * primario. Las partes que no aplican no se montan (UX3-25: sin contenedores vacíos).
 */
export function ProductionPanel({
  case: c,
  missing,
  role,
  stages,
  stagesError = false,
  onRemakeCreated,
  self,
}: {
  case: CaseDetail
  missing: string[]
  role: UserRole
  /** Fases, activas o no: `StageControl` resuelve el nombre de una fase ya desactivada. */
  stages: Stage[]
  stagesError?: boolean
  onRemakeCreated?: (created: { id: string }) => void
  /** Quien usa la app: el mensajero envía con él mismo (`ShipDialog`). Obligatorio: la barra
   * de acciones lo necesita para el envío y para saber qué entregas son suyas. */
  self: DeliverySelf
}) {
  const showStage = !!c.currentStageId && isStageVisible(c.status)
  const titleId = useId()
  const nav = stageNavigation(stages, c.currentStageId, stagesError)
  // Con las fases todavía en vuelo se asume que hay siguiente: «Finalizar» no se adelanta como
  // primario para luego cederle el sitio a «Avanzar fase» cuando lleguen. Con error o con la
  // fase actual desactivada no hay siguiente conocida: «Avanzar fase» queda deshabilitado en
  // secundario y el primario es «Finalizar» (`stageNavigation`, misma fuente que `StageControl`).
  const hasNextStage =
    showStage && canChangeStage(c.status) && (nav.loading || nav.next !== undefined)

  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle asChild>
          <h2 id={titleId}>Producción</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* UX4-09: la recogida o entrega va junto a su acción, arriba del panel. */}
        <DeliverySummary pending={c.pendingDelivery} lastDelivered={c.lastDelivered} />
        <div
          className={cn(
            'grid grid-cols-1 gap-5',
            showStage && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]',
          )}
        >
          {showStage && (
            <StageControl case={c} stages={stages} stagesError={stagesError} role={role} />
          )}
          <div className={cn(!showStage && 'max-w-sm')}>
            <TechnicianSelect case={c} role={role} />
          </div>
        </div>
        <CaseActions
          case={c}
          missing={missing}
          role={role}
          hasNextStage={hasNextStage}
          onRemakeCreated={onRemakeCreated}
          self={self}
          className="border-t border-border pt-4"
        />
      </CardContent>
    </Card>
  )
}
