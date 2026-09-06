import type { caseInputSchema } from '@dentalware/shared'
import { Controller, type Control } from 'react-hook-form'
import type { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

type CaseFormValues = z.input<typeof caseInputSchema>

/** Sección "Notas": observaciones, prescripción y notas internas de laboratorio. */
export function NotesFields({ control }: { control: Control<CaseFormValues> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notas</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Controller
            name="observations"
            control={control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="case-observations">Observaciones</FieldLabel>
                <Textarea {...field} id="case-observations" rows={3} value={field.value ?? ''} />
              </Field>
            )}
          />
          <Controller
            name="prescription"
            control={control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="case-prescription">Prescripción</FieldLabel>
                <Textarea {...field} id="case-prescription" rows={3} value={field.value ?? ''} />
              </Field>
            )}
          />
          <Controller
            name="internalNotes"
            control={control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="case-internalNotes">Notas internas</FieldLabel>
                <Textarea {...field} id="case-internalNotes" rows={3} value={field.value ?? ''} />
              </Field>
            )}
          />
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
