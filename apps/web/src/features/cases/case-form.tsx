import {
  caseInputSchema,
  missingForAccept,
  toIsoDate,
  type CaseInput,
  type UserRole,
} from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useClinics } from '@/features/clinics/use-clinics'
import { useDoctors } from '@/features/doctors/use-doctors'
import { formatMoney } from '@/features/products/pricing-unit-label'
import { useClinicPrices, useProducts } from '@/features/products/use-products'
import type { CaseDetail } from './api'
import { CaseItemsEditor } from './case-items-editor'
import { computeTotals } from './case-totals'
import { ChecklistField } from './checklist-field'
import { ClinicPatientFields } from './clinic-patient-fields'
import { ColorFields } from './color-fields'
import { NotesFields } from './notes-fields'

export type CaseFormValues = z.input<typeof caseInputSchema>

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
          <ClinicPatientFields
            control={control}
            clinicId={clinicId || ''}
            clinics={clinics.data ?? []}
            doctors={doctors.data ?? []}
            onClinicChange={handleClinicChange}
          />

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

          <ColorFields control={control} />

          <Card>
            <CardHeader>
              <CardTitle>Lista de verificación</CardTitle>
            </CardHeader>
            <CardContent>
              <ChecklistField control={control} />
            </CardContent>
          </Card>

          <NotesFields control={control} />
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
