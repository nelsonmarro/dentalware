import {
  canRemake,
  REMAKE_RESPONSIBILITIES,
  remakeSchema,
  type RemakeInput,
  type RemakeResponsibility,
} from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { CaseDetail } from './api'
import { useCreateRemake } from './use-cases'

const REMAKE_RESPONSIBILITY_LABEL: Record<RemakeResponsibility, string> = {
  laboratorio: 'Laboratorio',
  clinica: 'Clínica',
  compartida: 'Compartida',
}

type RemakeFormValues = z.input<typeof remakeSchema>

/**
 * Diálogo "Repetir trabajo" (CIC-4): motivo, responsabilidad y porcentaje a cobrar a la
 * clínica (`remakeSchema`). Solo se ofrece desde los estados de `REMAKEABLE_STATUSES`
 * (`canRemake`, shared — no una lista a mano). Al crear el hijo, `onCreated` deja que quien
 * monta este diálogo navegue a su ficha (ruling de la Tarea 9: el hijo puede nacer incompleto
 * si el padre ya venció su fecha de entrega, así que hay que llevar al usuario ahí, no
 * dejarlo en el padre sin señal de qué pasó).
 */
export function RemakeDialog({
  case: c,
  onCreated,
}: {
  case: CaseDetail
  onCreated?: (created: CaseDetail) => void
}) {
  const [open, setOpen] = useState(false)
  const create = useCreateRemake(c.id)
  const { register, handleSubmit, reset, formState } = useForm<
    RemakeFormValues,
    unknown,
    RemakeInput
  >({
    resolver: zodResolver(remakeSchema),
    defaultValues: { motivo: '', responsabilidad: 'laboratorio', cobroPct: 100 },
  })

  if (!canRemake(c.status)) return null

  function handleOpenChange(next: boolean) {
    if (!next) reset({ motivo: '', responsabilidad: 'laboratorio', cobroPct: 100 })
    setOpen(next)
  }

  function submit(data: RemakeInput) {
    create.mutate(data, {
      onSuccess: (created) => {
        handleOpenChange(false)
        onCreated?.(created)
      },
    })
  }

  return (
    <>
      <Button variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
        Repetir
      </Button>
      <FormDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Repetir trabajo"
        description="Crea un trabajo nuevo con las mismas líneas y piezas, listo para empezar de cero."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Volver
            </Button>
            <Button type="submit" form="remake-form" disabled={create.isPending}>
              {create.isPending ? 'Creando…' : 'Crear repetición'}
            </Button>
          </>
        }
      >
        <form
          id="remake-form"
          onSubmit={handleSubmit(submit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <Field data-invalid={!!formState.errors.motivo}>
            <FieldLabel htmlFor="remake-motivo">Motivo</FieldLabel>
            <Textarea
              {...register('motivo')}
              id="remake-motivo"
              aria-invalid={!!formState.errors.motivo}
              rows={3}
            />
            {formState.errors.motivo && <FieldError errors={[formState.errors.motivo]} />}
          </Field>
          <Field data-invalid={!!formState.errors.responsabilidad}>
            <FieldLabel htmlFor="remake-responsabilidad">Responsabilidad</FieldLabel>
            <select
              {...register('responsabilidad')}
              id="remake-responsabilidad"
              aria-invalid={!!formState.errors.responsabilidad}
              className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {REMAKE_RESPONSIBILITIES.map((r) => (
                <option key={r} value={r}>
                  {REMAKE_RESPONSIBILITY_LABEL[r]}
                </option>
              ))}
            </select>
            {formState.errors.responsabilidad && (
              <FieldError errors={[formState.errors.responsabilidad]} />
            )}
          </Field>
          <Field data-invalid={!!formState.errors.cobroPct}>
            <FieldLabel htmlFor="remake-cobro">Porcentaje a cobrar a la clínica</FieldLabel>
            <Input
              {...register('cobroPct')}
              id="remake-cobro"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              aria-invalid={!!formState.errors.cobroPct}
            />
            {formState.errors.cobroPct && <FieldError errors={[formState.errors.cobroPct]} />}
          </Field>
        </form>
      </FormDialog>
    </>
  )
}
