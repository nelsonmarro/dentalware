import type { FieldError as FormFieldError, UseFormRegisterReturn } from 'react-hook-form'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatLongDate } from '@/features/cases/date-format'

/**
 * Campo de fecha de cuentas (pago, ajuste y periodo del estado de cuenta) con la fecha escrita
 * debajo, «Lunes, 1 de junio de 2026» (UX5-08). Chrome pinta el `input type="date"` con el idioma
 * de su interfaz, no con `lang`: en inglés, el 1 de junio sale «06/01/2026», que aquí se lee 6 de
 * enero. La fecha escrita es la descripción del campo (`aria-describedby`) y sigue a lo que se
 * escribe; con el campo vacío o a medio escribir no dice nada.
 */
export function DateField({
  id,
  label,
  value,
  max,
  error,
  registration,
  className,
}: {
  id: string
  label: string
  /** Valor actual del campo (`AAAA-MM-DD`), con `useWatch`. */
  value: string | undefined
  max: string
  error: FormFieldError | undefined
  registration: UseFormRegisterReturn
  className?: string
}) {
  const longDate = formatLongDate(value)
  const descriptionId = `${id}-escrita`
  return (
    <Field data-invalid={!!error} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        {...registration}
        id={id}
        type="date"
        max={max}
        className="h-11"
        aria-invalid={!!error}
        aria-describedby={longDate ? descriptionId : undefined}
      />
      {longDate && <FieldDescription id={descriptionId}>{longDate}</FieldDescription>}
      {error && <FieldError errors={[error]} />}
    </Field>
  )
}
