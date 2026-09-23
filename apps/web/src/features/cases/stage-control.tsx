import {
  isLastStage,
  nextStage,
  previousStage,
  stageChangeSchema,
  type CaseStatus,
  type StageChangeInput,
  type UserRole,
} from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import type { Stage } from '@/features/stages/api'
import type { CaseDetail } from './api'
import { useCaseAction, useChangeStage } from './use-cases'

/** Solo estos roles cambian de fase (mismo criterio que `canChangeStage` en `routes.ts`,
 * defensa en profundidad: la web no confía solo en ocultar el botón). */
function canControlStage(role: UserRole): boolean {
  return role === 'admin' || role === 'recepcion' || role === 'tecnico'
}

/** Motivo (en español, UI) de por qué no se puede cambiar de fase en cada estado que no sea
 * `en_proceso` — mismo criterio que `STAGE_CHANGE_BLOCKED_REASON` del servicio (API), pero un
 * `Record` propio: es texto de presentación, no la regla en sí (la regla es "solo en_proceso
 * cambia de fase", una sola comparación, no una lista que haya que mantener sincronizada).
 * `Record<Exclude<CaseStatus, 'en_proceso'>, string>` exhaustivo a propósito (mismo patrón que
 * `CONFIRM_DESCRIPTIONS` en `case-actions.tsx`): un estado nuevo no compila hasta tener texto. */
const STAGE_BLOCKED_MESSAGE: Record<Exclude<CaseStatus, 'en_proceso'>, string> = {
  nuevo: 'El trabajo no tiene fase todavía: acéptalo primero.',
  en_espera: 'El trabajo está pausado: reanúdalo para volver a cambiar de fase.',
  en_prueba: 'El trabajo está en una prueba en boca: recíbela para volver a cambiar de fase.',
  terminado: 'El trabajo ya está terminado.',
  enviado: 'El trabajo ya fue enviado.',
  entregado: 'El trabajo ya fue entregado.',
  cancelado: 'El trabajo está cancelado.',
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

/** Control de fase de producción de la ficha (CIC-2/CIC-5): fase actual, "Avanzar fase" /
 * "Retroceder fase" (con motivo) mientras el trabajo está `en_proceso`, y "Finalizar" en vez
 * de "Avanzar" en la última fase activa (avanzar ahí no hace nada: la API responde 409 y
 * pide usar "finalizar"). Fuera de `en_proceso` la fase queda de solo lectura con el motivo
 * de por qué. Sin fase asignada (trabajo `nuevo`, todavía sin aceptar) no muestra nada. */
export function StageControl({
  case: c,
  stages,
  role,
}: {
  case: CaseDetail
  stages: Stage[]
  role: UserRole
}) {
  const [showBack, setShowBack] = useState(false)
  const [showFinish, setShowFinish] = useState(false)
  const changeStage = useChangeStage(c.id)
  const finalize = useCaseAction(c.id)

  if (!c.currentStageId) return null
  const current = stages.find((s) => s.id === c.currentStageId)
  const canControl = canControlStage(role) && c.status === 'en_proceso'
  const next = canControl ? nextStage(stages, c.currentStageId) : undefined
  const last = canControl && isLastStage(stages, c.currentStageId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fase de producción</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm font-medium">{current?.name ?? 'Fase desconocida'}</p>
        {c.status !== 'en_proceso' && (
          <p className="text-sm text-muted-foreground">{STAGE_BLOCKED_MESSAGE[c.status]}</p>
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
            {last ? (
              <Button
                className="w-full sm:w-auto"
                disabled={finalize.isPending}
                onClick={() => setShowFinish(true)}
              >
                Finalizar
              </Button>
            ) : (
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
      <ConfirmDialog
        open={showFinish}
        onOpenChange={setShowFinish}
        title="Finalizar"
        description='El trabajo pasará a "Terminado" con la fecha de hoy. No hay ninguna acción para devolverlo a "En proceso".'
        confirmLabel="Finalizar"
        pending={finalize.isPending}
        onConfirm={() => {
          finalize.mutate(
            { accion: 'finalizar', motivo: null },
            { onSuccess: () => setShowFinish(false) },
          )
        }}
      />
    </Card>
  )
}
