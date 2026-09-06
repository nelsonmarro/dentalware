import { SHADE_SYSTEM_LABEL, SHADE_SYSTEMS, type caseInputSchema } from '@dentalware/shared'
import { Controller, type Control } from 'react-hook-form'
import type { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type CaseFormValues = z.input<typeof caseInputSchema>

/** Sección "Color": ficha de color libre, sistema (VITA…) y referencia. */
export function ColorFields({ control }: { control: Control<CaseFormValues> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Color</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <Controller
            name="shade"
            control={control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="case-shade">Color</FieldLabel>
                <Input
                  {...field}
                  id="case-shade"
                  placeholder="A2"
                  className="h-11"
                  value={field.value ?? ''}
                />
              </Field>
            )}
          />
          <Controller
            name="shadeSystem"
            control={control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="case-shadeSystem">Sistema</FieldLabel>
                <Select name={field.name} value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger id="case-shadeSystem" aria-label="Sistema" className="h-11 w-full">
                    <SelectValue placeholder="Sin indicar" />
                  </SelectTrigger>
                  <SelectContent>
                    {SHADE_SYSTEMS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SHADE_SYSTEM_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
          <Controller
            name="reference"
            control={control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="case-reference">Referencia</FieldLabel>
                <Input {...field} id="case-reference" className="h-11" value={field.value ?? ''} />
              </Field>
            )}
          />
        </div>
      </CardContent>
    </Card>
  )
}
