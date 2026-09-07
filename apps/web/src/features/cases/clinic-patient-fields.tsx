import {
  CASE_PRIORITIES,
  PATIENT_SEXES,
  type CasePriority,
  type PatientSex,
  type caseInputSchema,
} from '@dentalware/shared'
import { Controller, type Control } from 'react-hook-form'
import type { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Clinic } from '@/features/clinics/api'
import type { Doctor } from '@/features/doctors/api'

type CaseFormValues = z.input<typeof caseInputSchema>

const PRIORITY_LABEL: Record<CasePriority, string> = { normal: 'Normal', urgente: 'Urgente' }
const SEX_LABEL: Record<PatientSex, string> = { M: 'Masculino', F: 'Femenino' }

/** Sección "Clínica y paciente": clínica → doctor dependiente, datos del paciente,
 * número de caja, prioridad y fechas de ingreso/deseada. */
export function ClinicPatientFields({
  control,
  clinicId,
  clinics,
  doctors,
  onClinicChange,
}: {
  control: Control<CaseFormValues>
  clinicId: string
  clinics: Clinic[]
  doctors: Doctor[]
  onClinicChange: (clinicId: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clínica y paciente</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="clinicId"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="case-clinicId">Clínica</FieldLabel>
                  <Select name={field.name} value={field.value} onValueChange={onClinicChange}>
                    <SelectTrigger
                      id="case-clinicId"
                      aria-label="Clínica"
                      aria-invalid={fieldState.invalid}
                      className="h-11 w-full"
                    >
                      <SelectValue placeholder="Elegir clínica" />
                    </SelectTrigger>
                    <SelectContent>
                      {clinics.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="doctorId"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="case-doctorId">Doctor</FieldLabel>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!clinicId}
                  >
                    <SelectTrigger
                      id="case-doctorId"
                      aria-label="Doctor"
                      aria-invalid={fieldState.invalid}
                      className="h-11 w-full"
                    >
                      <SelectValue placeholder="Elegir doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>
          <Controller
            name="patientRef"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="case-patientRef">Referencia del paciente</FieldLabel>
                <Input
                  {...field}
                  id="case-patientRef"
                  className="h-11"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="patientAge"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="case-patientAge">Edad</FieldLabel>
                  <Input
                    {...field}
                    id="case-patientAge"
                    type="number"
                    min={0}
                    max={120}
                    className="h-11"
                    value={(field.value ?? '') as string | number}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="patientSex"
              control={control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="case-patientSex">Sexo</FieldLabel>
                  <Select
                    name={field.name}
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="case-patientSex" aria-label="Sexo" className="h-11 w-full">
                      <SelectValue placeholder="Sin indicar" />
                    </SelectTrigger>
                    <SelectContent>
                      {PATIENT_SEXES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {SEX_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="boxNumber"
              control={control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="case-boxNumber">Nº de caja</FieldLabel>
                  <Input
                    {...field}
                    id="case-boxNumber"
                    className="h-11"
                    value={field.value ?? ''}
                  />
                </Field>
              )}
            />
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="case-priority">Prioridad</FieldLabel>
                  <Select name={field.name} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="case-priority"
                      aria-label="Prioridad"
                      className="h-11 w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CASE_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {PRIORITY_LABEL[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="receivedAt"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="case-receivedAt">Fecha de ingreso</FieldLabel>
                  <Input
                    {...field}
                    id="case-receivedAt"
                    type="date"
                    className="h-11"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="dueDate"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="case-dueDate">Fecha deseada</FieldLabel>
                  <Input
                    {...field}
                    id="case-dueDate"
                    type="date"
                    className="h-11"
                    value={field.value ?? ''}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
