import {
  canChangeStage,
  STAGE_CHANGE_BLOCKED_REASON,
  STAGE_CHANGE_ROLES,
  toIsoDate,
  type UserRole,
  hasRole,
} from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { Camera } from 'lucide-react'
import { useRef } from 'react'
import { EmptyState } from '@/components/empty-state'
import { LoadError } from '@/components/load-error'
import { Button } from '@/components/ui/button'
import { useStages } from '@/features/stages/use-stages'
import { isNotFoundError } from '@/lib/api-error'
import { AlertChip } from './alert-chip'
import { isPhoto } from './attachment-kind'
import { dueBadge, isStageVisible } from './case-views'
import { formatDate } from './date-format'
import { StatusChip } from './status-chip'
import { useAttachments } from './use-attachments'
import { stageNavigation } from './stage-navigation'
import { useCaseByCode, useChangeStage } from './use-cases'
import { usePhotoUpload } from './use-photo-upload'

/** Mismo criterio de rol que `StageControl` (`STAGE_CHANGE_ROLES` de shared, I-5 + M-5 + M-9):
 * no se inventa una lista nueva aquí. */
function canControlStage(role: UserRole): boolean {
  return hasRole(STAGE_CHANGE_ROLES, role)
}

/**
 * Ficha corta del trabajo (Tarea 15, FIC-2 #72 / FIC-3 #73): pantalla a la que llega un
 * técnico al escanear el QR de la orden impresa (ruta `/t/:code`, montada dentro de `_app`
 * para heredar la sesión y el `?redirect=` de vuelta tras el login — ver `routes/_app/t.$code`).
 * Móvil primero: código, paciente, entrega, fase actual y dos acciones grandes para el puesto
 * de trabajo (con guantes, sin gestos finos): «Avanzar a {fase siguiente}» y «Añadir foto».
 * Retroceder fase y finalizar no son parte de FIC-3: solo la ficha completa los ofrece.
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
  const attachments = useAttachments(caseId ?? '')

  if (q.isPending) return <p className="text-sm text-muted-foreground">Cargando…</p>
  if (q.isError) {
    // Código inexistente (404) o mal formado (422): mismo mensaje claro, nunca el error crudo
    // de la API ni el errorComponent del router (decisión de la Tarea 15). Cualquier otro
    // error (sin red, el servidor caído) no es "no encontrado": es "no se pudo cargar"
    // (UX3-02), y se puede reintentar.
    if (!isNotFoundError(q.error, [422])) {
      return <LoadError onRetry={() => void q.refetch()} autoFocus />
    }
    return (
      <EmptyState
        title="No encontrado"
        pageTitle
        description="Revisa el código impreso en la orden o búscalo en la lista de trabajos."
        action={
          // UX3-27: la salida que el texto sugiere, con el objetivo táctil de 44 px del `Button`.
          <Button variant="outline" asChild>
            <Link to="/trabajos">Ir a trabajos</Link>
          </Button>
        }
      />
    )
  }
  if (!q.data) return null

  const c = q.data.case
  // UX3-22: la misma fecha y el mismo semáforo que la lista y «Mis trabajos» (`dueBadge`):
  // un terminado con la fecha pasada no está «atrasado» en ningún sitio.
  const dueDate = c.promisedDate ?? c.dueDate
  const badge = dueBadge(dueDate, toIsoDate(new Date()), c.status)
  // Misma fuente que la ficha completa (`stageNavigation`): qué fase sigue, si es la última y
  // si la actual está desactivada.
  const nav = stageNavigation(stages.data ?? [], c.currentStageId, stages.isError)
  // Misma clasificación que `StageControl` (sin inventar una lista nueva): si el rol no puede
  // cambiar de fase, el botón simplemente no aparece (ni motivo: es el mismo criterio que usa
  // la ficha completa para mensajero); si el rol sí puede pero el estado no, aparece el motivo.
  const roleCanControl = canControlStage(role)
  const canControl = roleCanControl && canChangeStage(c.status)
  const next = canControl ? nav.next : undefined
  const last = canControl && nav.last
  // `canChangeStage` repetido aquí (en vez de reusar una variable) a propósito: es un
  // predicado de tipo (`status is 'en_proceso'`) y solo estrecha `c.status` a
  // `Exclude<CaseStatus, 'en_proceso'>` dentro de esta misma condición (mismo patrón que
  // `StageControl`), lo que deja indexar `STAGE_CHANGE_BLOCKED_REASON` sin un cast.
  const blockedReason =
    roleCanControl && !canChangeStage(c.status) ? STAGE_CHANGE_BLOCKED_REASON[c.status] : null
  // Mismos avisos que `StageControl` (M-1 de la revisión de la Tarea 15): sin ellos, una fase
  // desactivada o un fallo al cargar las fases dejaban "Avanzar fase" deshabilitado sin motivo.
  const stagesProblem = !canControl
    ? null
    : stages.isError
      ? 'No se pudieron cargar las fases. Recarga la página.'
      : stages.isSuccess && (!nav.current || nav.currentInactive)
        ? 'La fase en la que estaba este trabajo ya no está activa. Pide a administración que la reactive en Configuración → Fases.'
        : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{c.code}</h1>
          <p className="text-lg">{c.patientRef}</p>
        </div>
        <StatusChip status={c.status} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* M-2: sin fecha, con palabras; el «—» de `formatDate` no se lee en voz alta ni de un
            vistazo. */}
        <span className="text-base font-medium">
          {`Entrega: ${dueDate ? formatDate(dueDate) : 'sin fecha'}`}
        </span>
        {c.priority === 'urgente' && <AlertChip tone="destructive">Urgente</AlertChip>}
        {badge === 'atrasado' && <AlertChip tone="destructive">Atrasado</AlertChip>}
        {badge === 'hoy' && <AlertChip tone="amber">Vence hoy</AlertChip>}
      </div>
      {/* UX3-23: misma regla que la ficha completa (`case-header`, `stage-control`): fuera de
          producción la fase guardada ya no describe el trabajo (un terminado no está en
          «Recepción»). */}
      {c.stage && isStageVisible(c.status) && (
        <p className="text-sm text-muted-foreground">
          <span>Fase:</span> <span className="font-medium text-foreground">{c.stage.name}</span>
        </p>
      )}
      {blockedReason && <p className="text-sm text-muted-foreground">{blockedReason}</p>}
      {stagesProblem && <p className="text-sm text-muted-foreground">{stagesProblem}</p>}
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
            {/* UX3-27: el destino en el rótulo; sin fase siguiente conocida (cargando, error,
                fase desactivada) no se inventa y el botón queda deshabilitado. */}
            {next ? `Avanzar a ${next.name}` : 'Avanzar fase'}
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
        {/* UX3-08: el aviso «Foto añadida» se va; el contador queda en la ficha. Sin dato si
            los adjuntos no cargaron (un fallo de red no se presenta como «Fotos: 0»). */}
        {attachments.isSuccess && (
          <p className="text-center text-sm text-muted-foreground">
            {`Fotos: ${attachments.data.filter(isPhoto).length}`}
          </p>
        )}
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
