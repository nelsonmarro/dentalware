import { statementRangeFormSchema, toIsoDate } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type Range = { desde: string; hasta: string }
type Schema = ReturnType<typeof statementRangeFormSchema>

/** El periodo del estado de cuenta (CTA-5): dos fechas y «Ver periodo». Una fecha final anterior
 * a la inicial, o posterior a hoy (la API no la acepta, I-2), se avisa bajo «Hasta» sin pedir
 * nada, con la regla de `statementRangeFormSchema` de shared (UX5-19); los dos campos llevan hoy
 * como máximo. */
export function StatementRangeForm({
  range,
  onSubmit,
}: {
  range: Range
  onSubmit: (range: Range) => void
}) {
  const today = toIsoDate(new Date())
  const schema = useMemo(() => statementRangeFormSchema(today), [today])
  const { register, handleSubmit, formState } = useForm<z.input<Schema>, unknown, z.output<Schema>>(
    { resolver: zodResolver(schema), defaultValues: range },
  )
  const { errors } = formState

  return (
    <form
      noValidate
      aria-label="Periodo"
      onSubmit={(e) => void handleSubmit((v) => onSubmit({ desde: v.desde, hasta: v.hasta }))(e)}
      className="grid grid-cols-2 items-start gap-3 sm:flex sm:flex-wrap sm:items-end"
    >
      <Field data-invalid={!!errors.desde} className="sm:w-44">
        <FieldLabel htmlFor="estado-desde">Desde</FieldLabel>
        <Input
          {...register('desde')}
          id="estado-desde"
          type="date"
          max={today}
          lang="es-EC"
          className="h-11"
          aria-invalid={!!errors.desde}
        />
        {errors.desde && <FieldError errors={[errors.desde]} />}
      </Field>
      <Field data-invalid={!!errors.hasta} className="sm:w-44">
        <FieldLabel htmlFor="estado-hasta">Hasta</FieldLabel>
        <Input
          {...register('hasta')}
          id="estado-hasta"
          type="date"
          max={today}
          lang="es-EC"
          className="h-11"
          aria-invalid={!!errors.hasta}
        />
        {errors.hasta && <FieldError errors={[errors.hasta]} />}
      </Field>
      <Button type="submit" variant="outline" className="col-span-2 h-11 sm:col-span-1">
        Ver periodo
      </Button>
    </form>
  )
}
