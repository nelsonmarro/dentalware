import {
  CASE_PRIORITIES,
  caseInputSchema,
  missingForAccept,
  PATIENT_SEXES,
  SHADE_SYSTEM_LABEL,
  SHADE_SYSTEMS,
  toIsoDate,
  type CaseInput,
  type CasePriority,
  type PatientSex,
  type UserRole,
} from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import { useClinics } from '@/features/clinics/use-clinics'
import { useDoctors } from '@/features/doctors/use-doctors'
import { formatMoney } from '@/features/products/pricing-unit-label'
import { useClinicPrices, useProducts } from '@/features/products/use-products'
import type { CaseDetail } from './api'
import { CaseItemsEditor } from './case-items-editor'
import { computeTotals } from './case-totals'
import { ChecklistField } from './checklist-field'

export type CaseFormValues = z.input<typeof caseInputSchema>

const PRIORITY_LABEL: Record<CasePriority, string> = { normal: 'Normal', urgente: 'Urgente' }
const SEX_LABEL: Record<PatientSex, string> = { M: 'Masculino', F: 'Femenino' }

function emptyChecklist() {
  return { antagonista: false, mordida: false, color: false, fotos: false }
}

function newDefaults(): CaseFormValues {
  return {
    clinicId: '',
    doctorId: '',
    patientRef: '',
    patientAge: '',
    patientSex: null,
    boxNumber: '',
    priority: 'normal',
    receivedAt: toIsoDate(new Date()),
    dueDate: null,
    shade: '',
    shadeSystem: null,
    reference: '',
    checklist: emptyChecklist(),
    observations: '',
    prescription: '',
    internalNotes: '',
    assignedTechnicianId: null,
    items: [],
  }
}

function fromDetail(c: CaseDetail): CaseFormValues {
  return {
    clinicId: c.clinicId,
    doctorId: c.doctorId,
    patientRef: c.patientRef,
    patientAge: c.patientAge ?? '',
    patientSex: c.patientSex,
    boxNumber: c.boxNumber ?? '',
    priority: c.priority,
    receivedAt: c.receivedAt,
    dueDate: c.dueDate,
    shade: c.shade ?? '',
    shadeSystem: c.shadeSystem,
    reference: c.reference ?? '',
    checklist: c.checklist,
    observations: c.observations ?? '',
    prescription: c.prescription ?? '',
    internalNotes: c.internalNotes ?? '',
    assignedTechnicianId: c.assignedTechnicianId,
    items: c.items.map((i) => ({
      productId: i.productId,
      description: i.description ?? '',
      quantity: i.quantity,
      teeth: i.teeth,
      unitPrice: i.unitPrice,
      discountPct: Number(i.discountPct),
      material: i.material ?? '',
      notes: i.notes ?? '',
    })),
  }
}

function MissingPanel({ missing, className }: { missing: string[]; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Para aceptar falta</CardTitle>
      </CardHeader>
      <CardContent data-testid="missing-panel">
        {missing.length === 0 ? (
          <p className="text-sm font-medium text-primary">Todo listo para aceptar.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function CaseForm({
  initial,
  onSubmit,
  pending,
  role,
}: {
  initial?: CaseDetail
  onSubmit: (input: CaseInput, andNew: boolean) => void
  pending: boolean
  role: UserRole
}) {
  const canEditPrice = role === 'admin' || role === 'recepcion'
  const isEdit = initial !== undefined
  // `initial` no cambia durante la vida del formulario (cada edición monta una instancia
  // nueva de la página), así que calcular los valores iniciales una sola vez es seguro.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const defaultValues = useMemo(() => (initial ? fromDetail(initial) : newDefaults()), [])

  const form = useForm<CaseFormValues, unknown, CaseInput>({
    resolver: zodResolver(caseInputSchema),
    defaultValues,
  })
  const { control, handleSubmit, setValue } = form

  const clinicId = useWatch({ control, name: 'clinicId' })
  const watched = useWatch({ control })

  const clinics = useClinics(false)
  const doctors = useDoctors(clinicId || '', false)
  const products = useProducts(false)
  const clinicPrices = useClinicPrices(clinicId || '')

  const priceMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of clinicPrices.data ?? []) map.set(p.productId, p.price)
    return map
  }, [clinicPrices.data])

  const productsById = useMemo(
    () => new Map((products.data ?? []).map((p) => [p.id, p])),
    [products.data],
  )

  function handleClinicChange(id: string) {
    setValue('clinicId', id)
    setValue('doctorId', '')
  }

  const items = watched.items ?? []
  const totals = computeTotals(
    items.map((item) => ({
      unitPrice: item?.unitPrice ?? null,
      quantity: Number(item?.quantity ?? 0) || 0,
      discountPct: Number(item?.discountPct ?? 0) || 0,
    })),
  )

  const missing = missingForAccept({
    clinicId: watched.clinicId || null,
    doctorId: watched.doctorId || null,
    patientRef: watched.patientRef ?? null,
    dueDate: watched.dueDate || null,
    shade: watched.shade || null,
    prescription: watched.prescription || null,
    // La ficha de trabajo aún no expone el conteo de adjuntos (se agrega en la Tarea 10);
    // hasta entonces la prescripción solo se satisface con texto.
    hasPrescriptionDocument: false,
    requiresShade: false,
    checklist: {
      antagonista: watched.checklist?.antagonista ?? false,
      mordida: watched.checklist?.mordida ?? false,
      color: watched.checklist?.color ?? false,
      fotos: watched.checklist?.fotos ?? false,
    },
    items: items.map((item) => ({
      pricingUnit: productsById.get(item?.productId ?? '')?.pricingUnit ?? 'por_trabajo',
      teeth: item?.teeth ?? [],
    })),
  })

  function submit(andNew: boolean) {
    return handleSubmit((data) => onSubmit(data, andNew))
  }

  return (
    <form onSubmit={submit(false)} noValidate className="flex flex-col gap-6 pb-24 lg:pb-6">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_320px] lg:items-start">
        <MissingPanel missing={missing} className="order-first lg:order-2" />
        <div className="flex flex-col gap-6 lg:order-1">
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
                        <Select
                          name={field.name}
                          value={field.value}
                          onValueChange={handleClinicChange}
                        >
                          <SelectTrigger
                            id="case-clinicId"
                            aria-label="Clínica"
                            aria-invalid={fieldState.invalid}
                            className="h-11 w-full"
                          >
                            <SelectValue placeholder="Elegir clínica" />
                          </SelectTrigger>
                          <SelectContent>
                            {(clinics.data ?? []).map((c) => (
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
                            {(doctors.data ?? []).map((d) => (
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
                          <SelectTrigger
                            id="case-patientSex"
                            aria-label="Sexo"
                            className="h-11 w-full"
                          >
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
                        <Select
                          name={field.name}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
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

          <Card>
            <CardHeader>
              <CardTitle>Trabajo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <CaseItemsEditor
                form={form}
                clinicId={clinicId || ''}
                products={products.data ?? []}
                prices={priceMap}
                canEditPrice={canEditPrice}
              />
              {canEditPrice && (
                <div
                  data-testid="case-total"
                  className="flex items-center justify-between border-t border-border pt-4"
                >
                  <span className="text-sm text-muted-foreground">Total del trabajo</span>
                  <span className="font-mono text-lg font-semibold">
                    {formatMoney(totals.total)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

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
                      <Select
                        name={field.name}
                        value={field.value ?? ''}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          id="case-shadeSystem"
                          aria-label="Sistema"
                          className="h-11 w-full"
                        >
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
                      <Input
                        {...field}
                        id="case-reference"
                        className="h-11"
                        value={field.value ?? ''}
                      />
                    </Field>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lista de verificación</CardTitle>
            </CardHeader>
            <CardContent>
              <ChecklistField control={control} />
            </CardContent>
          </Card>

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
                      <Textarea
                        {...field}
                        id="case-observations"
                        rows={3}
                        value={field.value ?? ''}
                      />
                    </Field>
                  )}
                />
                <Controller
                  name="prescription"
                  control={control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="case-prescription">Prescripción</FieldLabel>
                      <Textarea
                        {...field}
                        id="case-prescription"
                        rows={3}
                        value={field.value ?? ''}
                      />
                    </Field>
                  )}
                />
                <Controller
                  name="internalNotes"
                  control={control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="case-internalNotes">Notas internas</FieldLabel>
                      <Textarea
                        {...field}
                        id="case-internalNotes"
                        rows={3}
                        value={field.value ?? ''}
                      />
                    </Field>
                  )}
                />
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 flex flex-col gap-2 border-t border-border bg-background/95 p-4 backdrop-blur sm:flex-row sm:justify-end lg:sticky">
        <Button asChild variant="outline" className="h-11 w-full sm:w-auto">
          <Link to="/trabajos">Cancelar</Link>
        </Button>
        {!isEdit && (
          <Button
            type="button"
            variant="secondary"
            className="h-11 w-full sm:w-auto"
            disabled={pending}
            onClick={submit(true)}
          >
            Guardar y nuevo
          </Button>
        )}
        <Button type="submit" className="h-11 w-full sm:w-auto" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}
