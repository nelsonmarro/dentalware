import type { DoctorInput } from '@dentalware/shared'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useClinic } from '@/features/clinics/use-clinics'
import type { Doctor } from '@/features/doctors/api'
import { DoctorForm } from '@/features/doctors/doctor-form'
import { DoctorsTable } from '@/features/doctors/doctors-table'
import { useDoctors, useSaveDoctor, useSetDoctorActive } from '@/features/doctors/use-doctors'
import { ClinicPricesTable } from '@/features/products/clinic-prices-table'

export const Route = createFileRoute('/_app/configuracion/clinicas/$clinicId')({
  component: ClinicDetailPage,
})

function ClinicDetailPage() {
  const { clinicId } = Route.useParams()
  const clinic = useClinic(clinicId)
  const [editing, setEditing] = useState<Doctor | null | 'new'>(null)
  const doctors = useDoctors(clinicId, true)
  const save = useSaveDoctor()
  const toggle = useSetDoctorActive()
  if (clinic.isPending) return <p className="text-sm text-muted-foreground">Cargando…</p>
  if (!clinic.data) return <p className="text-destructive">La clínica no existe.</p>
  const c = clinic.data
  function submit(input: DoctorInput) {
    save.mutate(
      { id: editing && editing !== 'new' ? editing.id : undefined, input },
      { onSuccess: () => setEditing(null) },
    )
  }
  const newButton = (
    <Button className="h-11" onClick={() => setEditing('new')}>
      <Plus className="size-4" /> Nuevo doctor
    </Button>
  )
  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/configuracion/clinicas"
        className="-my-2.5 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" /> Clínicas
      </Link>
      <PageHeader
        title={c.name}
        description={
          [c.city, c.address, c.phone, c.whatsapp].filter(Boolean).join(' · ') || undefined
        }
      />
      <Tabs defaultValue="doctores">
        <TabsList>
          <TabsTrigger value="doctores">Doctores</TabsTrigger>
          <TabsTrigger value="precios">Precios especiales</TabsTrigger>
        </TabsList>
        <TabsContent value="doctores" className="flex flex-col gap-4 pt-4">
          <div className="flex justify-end">{newButton}</div>
          {doctors.isPending ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <DoctorsTable
              doctors={doctors.data ?? []}
              onEdit={setEditing}
              onToggle={(d, active) => toggle.mutate({ id: d.id, active })}
              emptyAction={newButton}
            />
          )}
        </TabsContent>
        <TabsContent value="precios" className="pt-4">
          <ClinicPricesTable clinicId={clinicId} />
        </TabsContent>
      </Tabs>
      {editing !== null && (
        <DoctorForm
          key={editing === 'new' ? 'new' : editing.id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          clinicId={clinicId}
          doctor={editing === 'new' ? null : editing}
          onSubmit={submit}
          pending={save.isPending}
        />
      )}
    </div>
  )
}
