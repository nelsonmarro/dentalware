import {
  canChangeStage,
  isLastStage,
  nextStage,
  STAGE_CHANGE_BLOCKED_REASON,
  STAGE_CHANGE_ROLES,
  type UserRole,
} from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { Camera } from 'lucide-react'
import { useRef } from 'react'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { useStages } from '@/features/stages/use-stages'
import { StatusChip } from './status-chip'
import { useCaseByCode, useChangeStage } from './use-cases'
import { usePhotoUpload } from './use-photo-upload'

/** Mismo criterio de rol que `StageControl` (`STAGE_CHANGE_ROLES` de shared, I-5 + M-5 + M-9):
 * no se inventa una lista nueva aquí. */
function canControlStage(role: UserRole): boolean {
  return (STAGE_CHANGE_ROLES as readonly UserRole[]).includes(role)
}

/**
 * Ficha corta del trabajo (Tarea 15, FIC-2 #72 / FIC-3 #73): pantalla a la que llega un
 * técnico al escanear el QR de la orden impresa (ruta `/t/:code`, montada dentro de `_app`
 * para heredar la sesión y el `?redirect=` de vuelta tras el login — ver `routes/_app/t.$code`).
 * Móvil primero: código, paciente, fase actual y dos acciones grandes para el puesto de
 * trabajo (con guantes, sin gestos finos): "Avanzar fase" y "Añadir foto". Retroceder fase y
 * finalizar no son parte de FIC-3: solo la ficha completa los ofrece.
 *
 * Nunca precios: el enmascarado lo garantiza `GET /api/trabajos/codigo/:code` (mismo servicio
 * que `detail`); esta pantalla ni siquiera lee `total` ni `items`.
 */
export function QuickCase({ code, role }: { code: string; role: UserRole }) {
  const q = useCaseByCode(code)
  const stages = useStages(true)
  const caseId = q.data?.case.id
  const changeStage = useChangeStage(caseId ?? '')
  const photoInputRef = useRef<HTMLInputElement>(null)
  const { handleFiles, progress } = usePhotoUpload(caseId ?? '')

  if (q.isPending) return <p className="text-sm text-muted-foreground">Cargando…</p>
  // Código inexistente (404) o mal formado (422): mismo mensaje claro, nunca el error crudo
  // de la API ni el errorComponent del router (decisión de la Tarea 15).
  if (q.isError || !q.data) {
    return <EmptyState title="No encontrado" />
  }

  const c = q.data.case
  const activeStages = stages.data ?? []
  // Misma clasificación que `StageControl` (sin inventar una lista nueva): si el rol no puede
  // cambiar de fase, el botón simplemente no aparece (ni motivo: es el mismo criterio que usa
  // la ficha completa para mensajero); si el rol sí puede pero el estado no, aparece el motivo.
  const roleCanControl = canControlStage(role)
  const canControl = roleCanControl && canChangeStage(c.status)
  const next = canControl ? nextStage(activeStages, c.currentStageId) : undefined
  const last = canControl && isLastStage(activeStages, c.currentStageId)
  // `canChangeStage` repetido aquí (en vez de reusar una variable) a propósito: es un
  // predicado de tipo (`status is 'en_proceso'`) y solo estrecha `c.status` a
  // `Exclude<CaseStatus, 'en_proceso'>` dentro de esta misma condición (mismo patrón que
  // `StageControl`), lo que deja indexar `STAGE_CHANGE_BLOCKED_REASON` sin un cast.
  const blockedReason =
    roleCanControl && !canChangeStage(c.status) ? STAGE_CHANGE_BLOCKED_REASON[c.status] : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{c.code}</h1>
          <p className="text-lg">{c.patientRef}</p>
        </div>
        <StatusChip status={c.status} />
      </div>
      {c.stage && (
        <p className="text-sm text-muted-foreground">
          <span>Fase:</span> <span className="font-medium text-foreground">{c.stage.name}</span>
        </p>
      )}
      {blockedReason && <p className="text-sm text-muted-foreground">{blockedReason}</p>}
      {canControl && last && (
        <p className="text-sm text-muted-foreground">
          Es la última fase: usa la ficha completa para finalizar el trabajo.
        </p>
      )}
      <div className="flex flex-col gap-3">
        {canControl && !last && (
          <Button
            className="h-14 w-full text-base"
            disabled={!next || changeStage.isPending}
            onClick={() => changeStage.mutate({ direccion: 'avanzar', motivo: null })}
          >
            Avanzar fase
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="h-14 w-full text-base"
          onClick={() => photoInputRef.current?.click()}
        >
          <Camera /> Añadir foto
        </Button>
        {progress && (
          <span role="status" className="text-sm text-muted-foreground">
            {progress.done + 1} de {progress.total}…
          </span>
        )}
        {/* `aria-hidden` + `tabIndex={-1}`: el botón de arriba es el objetivo táctil real (ver
            el mismo criterio en `photo-uploader.tsx`, Tarea 15). */}
        <input
          ref={photoInputRef}
          type="file"
          aria-label="Añadir foto"
          aria-hidden="true"
          tabIndex={-1}
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          onChange={(e) => {
            void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {/* `flex h-11 items-center justify-center` (no solo texto subrayado): objetivo táctil de
          44 px como el resto de la pantalla — con guantes, también este enlace debe ser fácil
          de tocar, no solo las dos acciones principales. */}
      <Link
        to="/trabajos/$caseId"
        params={{ caseId: c.id }}
        className="flex h-11 items-center justify-center text-sm underline underline-offset-4"
      >
        Ver ficha completa
      </Link>
    </div>
  )
}
