import { statementRangeFormSchema, toIsoDate } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { DateField } from './date-field'

type Range = { desde: string; hasta: string }
type Schema = ReturnType<typeof statementRangeFormSchema>

/** El periodo del estado de cuenta (CTA-5): dos fechas y «Ver periodo». Una fecha final anterior
 * a la inicial, o posterior a hoy (la API no la acepta, I-2), se avisa bajo «Hasta» sin pedir
 * nada, con la regla de `statementRangeFormSchema` de shared (UX5-19); los dos campos llevan hoy
 * como máximo y, debajo, la fecha escrita (UX5-08). */
export function StatementRangeForm({
  range,
  onSubmit,
}: {
  range: Range
  onSubmit: (range: Range) => void
}) {
  const today = toIsoDate(new Date())
  const schema = useMemo(() => statementRangeFormSchema(today), [today])
  const { register, handleSubmit, formState, control } = useForm<
    z.input<Schema>,
    unknown,
    z.output<Schema>
  >({ resolver: zodResolver(schema), defaultValues: range })
  const { errors } = formState
  const [desde, hasta] = useWatch({ control, name: ['desde', 'hasta'] })

  return (
    <form
      noValidate
      aria-label="Periodo"
      onSubmit={(e) => void handleSubmit((v) => onSubmit({ desde: v.desde, hasta: v.hasta }))(e)}
      className="grid grid-cols-2 items-start gap-3 sm:flex sm:flex-wrap sm:items-start"
    >
      <DateField
        id="estado-desde"
        label="Desde"
        value={desde}
        max={today}
        error={errors.desde}
        registration={register('desde')}
        className="sm:w-64"
      />
      <DateField
        id="estado-hasta"
        label="Hasta"
        value={hasta}
        max={today}
        error={errors.hasta}
        registration={register('hasta')}
        className="sm:w-64"
      />
      {/* Alineado con los campos, no con la fecha escrita de debajo: baja lo que mide el rótulo. */}
      <Button type="submit" variant="outline" className="col-span-2 h-11 sm:col-span-1 sm:mt-7">
        Ver periodo
      </Button>
    </form>
  )
}
