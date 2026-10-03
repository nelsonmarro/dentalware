import {
  canRemake,
  fromCents,
  percentOfCents,
  REMAKE_CHARGE_PCT_BY_RESPONSIBILITY,
  REMAKE_RESPONSIBILITIES,
  remakeSchema,
  toCents,
  type RemakeInput,
  type RemakeResponsibility,
} from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatMoney } from '@/features/products/pricing-unit-label'
import type { CaseDetail } from './api'
import { useCreateRemake } from './use-cases'

const REMAKE_RESPONSIBILITY_LABEL: Record<RemakeResponsibility, string> = {
  laboratorio: 'Laboratorio',
  clinica: 'Clínica',
  compartida: 'Compartida',
}

type RemakeFormValues = z.input<typeof remakeSchema>

const DEFAULT_RESPONSIBILITY: RemakeResponsibility = 'laboratorio'
const DEFAULT_VALUES: RemakeFormValues = {
  motivo: '',
  responsabilidad: DEFAULT_RESPONSIBILITY,
  cobroPct: REMAKE_CHARGE_PCT_BY_RESPONSIBILITY[DEFAULT_RESPONSIBILITY],
}

/** Importes de la ayuda «Se cobrarán $ X de $ Y» con el porcentaje del campo, o `null` si no
 * hay total (técnico y mensajero lo reciben enmascarado por la API) o el porcentaje todavía no
 * es válido. */
function chargeHint(
  total: string | null,
  pct: RemakeFormValues['cobroPct'],
): { charge: string; total: string } | null {
  if (total === null) return null
  const parsed = remakeSchema.shape.cobroPct.safeParse(pct)
  if (!parsed.success) return null
  const totalCents = toCents(total)
  return {
    charge: formatMoney(fromCents(percentOfCents(totalCents, parsed.data))),
    total: formatMoney(fromCents(totalCents)),
  }
}

/**
 * Diálogo "Repetir trabajo" (CIC-4): motivo, responsabilidad y porcentaje a cobrar a la
 * clínica (`remakeSchema`). Solo se ofrece desde los estados de `REMAKEABLE_STATUSES`
 * (`canRemake`, shared — no una lista a mano). Al crear el hijo, `onCreated` deja que quien
 * monta este diálogo navegue a su ficha (ruling de la Tarea 9: el hijo puede nacer incompleto
 * si el padre ya venció su fecha de entrega, así que hay que llevar al usuario ahí, no
 * dejarlo en el padre sin señal de qué pasó).
 *
 * El porcentaje sigue a la responsabilidad (`REMAKE_CHARGE_PCT_BY_RESPONSIBILITY`, shared;
 * UX3-06) hasta que alguien lo escribe a mano: desde ahí se respeta lo escrito aunque cambie la
 * responsabilidad, y vuelve a seguirla al cerrar y reabrir el diálogo. Sin botón «usar
 * sugerido»: el campo es un número de dos o tres cifras y reescribirlo cuesta menos que un
 * control más en el diálogo.
 */
export function RemakeDialog({
  case: c,
  onCreated,
}: {
  case: CaseDetail
  onCreated?: (created: CaseDetail) => void
}) {
  const [open, setOpen] = useState(false)
  const [pctEdited, setPctEdited] = useState(false)
  const create = useCreateRemake(c.id)
  const { register, handleSubmit, reset, formState, setValue, control } = useForm<
    RemakeFormValues,
    unknown,
    RemakeInput
  >({
    resolver: zodResolver(remakeSchema),
    defaultValues: DEFAULT_VALUES,
  })
  const pct = useWatch({ control, name: 'cobroPct' })

  if (!canRemake(c.status)) return null

  const hint = chargeHint(c.total, pct)

  function handleOpenChange(next: boolean) {
    if (!next) {
      reset(DEFAULT_VALUES)
      setPctEdited(false)
    }
    setOpen(next)
  }

  const responsabilidad = register('responsabilidad', {
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (pctEdited) return
      const r = e.target.value as RemakeResponsibility
      setValue('cobroPct', REMAKE_CHARGE_PCT_BY_RESPONSIBILITY[r], { shouldValidate: true })
    },
  })
  const cobroPct = register('cobroPct', { onChange: () => setPctEdited(true) })

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
              {...responsabilidad}
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
            <div className="relative">
              <Input
                {...cobroPct}
                id="remake-cobro"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                aria-invalid={!!formState.errors.cobroPct}
                aria-describedby={hint ? 'remake-cobro-ayuda' : undefined}
                className="pr-9 font-mono"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-sm text-muted-foreground"
              >
                %
              </span>
            </div>
            {hint && (
              <FieldDescription id="remake-cobro-ayuda">
                Se cobrarán <span className="font-mono text-foreground">{hint.charge}</span> de{' '}
                <span className="font-mono">{hint.total}</span>
              </FieldDescription>
            )}
            {formState.errors.cobroPct && <FieldError errors={[formState.errors.cobroPct]} />}
          </Field>
        </form>
      </FormDialog>
    </>
  )
}
