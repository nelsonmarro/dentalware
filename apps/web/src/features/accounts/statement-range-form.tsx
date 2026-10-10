import { accountStatementQuerySchema } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type Range = { desde: string; hasta: string }

/** El periodo del estado de cuenta (CTA-5): dos fechas y «Ver periodo». Una fecha final anterior
 * a la inicial se avisa bajo «Hasta» con el mensaje del schema de shared, sin pedir nada. */
export function StatementRangeForm({
  range,
  onSubmit,
}: {
  range: Range
  onSubmit: (range: Range) => void
}) {
  const { register, handleSubmit, formState } = useForm<
    z.input<typeof accountStatementQuerySchema>,
    unknown,
    z.output<typeof accountStatementQuerySchema>
  >({ resolver: zodResolver(accountStatementQuerySchema), defaultValues: range })
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
