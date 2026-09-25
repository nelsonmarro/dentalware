import {
  canChangeStage,
  isLastStage,
  nextStage,
  previousStage,
  STAGE_CHANGE_BLOCKED_REASON,
  STAGE_CHANGE_ROLES,
  stageChangeSchema,
  type StageChangeInput,
  type UserRole,
} from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import type { Stage } from '@/features/stages/api'
import type { CaseDetail } from './api'
import { isStageVisible } from './case-views'
import { useChangeStage } from './use-cases'

/** Solo estos roles cambian de fase (I-5 + M-5 + M-9, ola de fixes del PR 1: `STAGE_CHANGE_ROLES`
 * de shared, antes una lista a mano aquí y en `routes.ts`/`service.ts`; defensa en profundidad:
 * la web no confía solo en ocultar el botón). */
function canControlStage(role: UserRole): boolean {
  return (STAGE_CHANGE_ROLES as readonly UserRole[]).includes(role)
}

type StageChangeFormValues = z.input<typeof stageChangeSchema>

/** Diálogo con motivo obligatorio para "Retroceder fase" (`stageChangeSchema` lo exige):
 * mismo patrón que `CaseActionDialog` (react-hook-form + `zodResolver`), con el `<textarea>`
 * además marcado `required` para que el campo se anuncie como obligatorio de por sí. */
function BackStageDialog({
  open,
  onOpenChange,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  onConfirm: (motivo: string) => void
}) {
  const { register, handleSubmit, reset, formState } = useForm<
    StageChangeFormValues,
    unknown,
    StageChangeInput
  >({
    resolver: zodResolver(stageChangeSchema),
    defaultValues: { direccion: 'retroceder', motivo: '' },
  })

  function handleOpenChange(next: boolean) {
    if (!next) reset({ direccion: 'retroceder', motivo: '' })
    onOpenChange(next)
  }

  function submit(data: StageChangeInput) {
    if (data.motivo) onConfirm(data.motivo)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Retroceder fase"
      description="El trabajo vuelve a la fase anterior."
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Volver
          </Button>
          <Button type="submit" form="stage-back-form" disabled={pending}>
            {pending ? 'Guardando…' : 'Confirmar'}
          </Button>
        </>
      }
    >
      <form id="stage-back-form" onSubmit={handleSubmit(submit)} noValidate>
        <Field data-invalid={!!formState.errors.motivo}>
          <FieldLabel htmlFor="stage-back-motivo">Motivo</FieldLabel>
          <Textarea
            {...register('motivo')}
            id="stage-back-motivo"
            aria-invalid={!!formState.errors.motivo}
            required
            rows={3}
          />
          {formState.errors.motivo && <FieldError errors={[formState.errors.motivo]} />}
        </Field>
      </form>
    </FormDialog>
  )
}

/** Control de fase de producción de la ficha (CIC-2/CIC-5): fase actual, "Avanzar fase" y
 * "Retroceder fase" (con motivo) mientras el trabajo está `en_proceso`. Fuera de
 * `en_proceso` la fase queda de solo lectura con el motivo de por qué. Sin fase asignada
 * (trabajo `nuevo`, todavía sin aceptar) no muestra nada.
 *
 * En la última fase **no** ofrece "Finalizar": esa acción la sirve la barra de acciones
 * (`case-actions.tsx`), que deriva de `CASE_TRANSITIONS` y es el único dueño de las
 * transiciones de estado. Tenerla aquí también dejaba dos botones idénticos en pantalla con
 * la misma copia duplicada, y rompía por modo estricto los E2E que buscan "Finalizar" por
 * nombre (I-1 de la revisión de la Tarea 9). Aquí solo se dice que es la última fase. */
export function StageControl({
  case: c,
  stages,
  stagesError = false,
  role,
}: {
  case: CaseDetail
  stages: Stage[]
  /** La consulta de fases falló (M-13): sin esto, `stages={[]}` se leía siempre como
   * "cargando" y la tarjeta se quedaba en "Cargando…" para siempre. */
  stagesError?: boolean
  role: UserRole
}) {
  const [showBack, setShowBack] = useState(false)
  const changeStage = useChangeStage(c.id)

  // M-3: `finalizar`/`cancelar` no limpian `currentStageId`, así que un trabajo ya cerrado
  // sigue trayendo fase. Fuera de los estados de producción la tarjeta es ruido.
  if (!c.currentStageId || !isStageVisible(c.status)) return null
  const stagesLoading = stages.length === 0 && !stagesError
  // El nombre se resuelve contra la lista completa (`useStages(true)` trae también las
  // inactivas): si el laboratorio desactivó la fase con el trabajo dentro, el técnico
  // necesita ver cuál era, no un "desconocida" que no le dice nada.
  const current = stages.find((s) => s.id === c.currentStageId)
  const currentInactive = !!current && !current.active
  const canControl = canControlStage(role) && canChangeStage(c.status)
  const next = canControl ? nextStage(stages, c.currentStageId) : undefined
  const last = canControl && isLastStage(stages, c.currentStageId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fase de producción</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm font-medium">
          {stagesError
            ? 'No se pudieron cargar las fases. Recarga la página.'
            : stagesLoading
              ? 'Cargando…'
              : (current?.name ?? 'Fase desconocida')}
        </p>
        {!canChangeStage(c.status) && (
          <p className="text-sm text-muted-foreground">{STAGE_CHANGE_BLOCKED_REASON[c.status]}</p>
        )}
        {canChangeStage(c.status) &&
          !stagesLoading &&
          !stagesError &&
          (currentInactive || !current) && (
            <p className="text-sm text-muted-foreground">
              La fase en la que estaba este trabajo ya no está activa. Pide a administración que la
              reactive en Configuración → Fases.
            </p>
          )}
        {last && (
          <p className="text-sm text-muted-foreground">
            Es la última fase: para terminar el trabajo usa "Finalizar" en las acciones de arriba.
          </p>
        )}
        {canControl && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={!previousStage(stages, c.currentStageId) || changeStage.isPending}
              onClick={() => setShowBack(true)}
            >
              Retroceder fase
            </Button>
            {!last && (
              <Button
                className="w-full sm:w-auto"
                disabled={!next || changeStage.isPending}
                onClick={() => changeStage.mutate({ direccion: 'avanzar', motivo: null })}
              >
                Avanzar fase
              </Button>
            )}
          </div>
        )}
      </CardContent>
      <BackStageDialog
        open={showBack}
        onOpenChange={setShowBack}
        pending={changeStage.isPending}
        onConfirm={(motivo) => {
          changeStage.mutate(
            { direccion: 'retroceder', motivo },
            { onSuccess: () => setShowBack(false) },
          )
        }}
      />
    </Card>
  )
}
