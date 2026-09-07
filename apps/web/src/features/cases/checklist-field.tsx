import { CHECKLIST_KEYS, CHECKLIST_LABEL, type caseInputSchema } from '@dentalware/shared'
import { Controller, type Control } from 'react-hook-form'
import type { z } from 'zod'
import { Field, FieldLabel } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'

type CaseFormValues = z.input<typeof caseInputSchema>

/** Los 4 interruptores de la orden en papel: antagonista, mordida, color y fotos. */
export function ChecklistField({ control }: { control: Control<CaseFormValues> }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CHECKLIST_KEYS.map((key) => (
        <Controller
          key={key}
          name={`checklist.${key}`}
          control={control}
          render={({ field }) => (
            <Field
              orientation="horizontal"
              className="justify-between rounded-lg border border-border p-3"
            >
              <FieldLabel htmlFor={`checklist-${key}`}>{CHECKLIST_LABEL[key]}</FieldLabel>
              <Switch
                id={`checklist-${key}`}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </Field>
          )}
        />
      ))}
    </div>
  )
}
