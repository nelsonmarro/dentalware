import type { ClinicInput } from '@dentalware/shared'
import { createFileRoute, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { Clinic } from '@/features/clinics/api'
import { ClinicForm } from '@/features/clinics/clinic-form'
import { ClinicsTable } from '@/features/clinics/clinics-table'
import { useClinics, useSaveClinic, useSetClinicActive } from '@/features/clinics/use-clinics'

export const Route = createFileRoute('/_app/configuracion/clinicas')({ component: ClinicsRoute })

function ClinicsRoute() {
  // Si hay una clínica seleccionada ($clinicId), la ruta hija ocupa la pantalla.
  const matchRoute = useMatchRoute()
  if (matchRoute({ to: '/configuracion/clinicas/$clinicId', fuzzy: true })) return <Outlet />
  return <ClinicsPage />
}

function ClinicsPage() {
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<Clinic | null | 'new'>(null)
  const clinics = useClinics(showInactive)
  const save = useSaveClinic()
  const toggle = useSetClinicActive()

  function submit(input: ClinicInput) {
    save.mutate(
      { id: editing && editing !== 'new' ? editing.id : undefined, input },
      { onSuccess: () => setEditing(null) },
    )
  }
  const newButton = (
    <Button className="h-11" onClick={() => setEditing('new')}>
      <Plus className="size-4" /> Nueva clínica
    </Button>
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clínicas"
        description="Clientes del laboratorio y sus condiciones de crédito."
        action={newButton}
      />
      <div className="flex items-center gap-2">
        <Switch id="clinicas-inactivas" checked={showInactive} onCheckedChange={setShowInactive} />
        <Label htmlFor="clinicas-inactivas">Mostrar inactivas</Label>
      </div>
      {clinics.isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <ClinicsTable
          clinics={clinics.data ?? []}
          onEdit={setEditing}
          onToggle={(c, active) => toggle.mutate({ id: c.id, active })}
          emptyAction={newButton}
        />
      )}
      {editing !== null && (
        <ClinicForm
          key={editing === 'new' ? 'new' : editing.id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          clinic={editing === 'new' ? null : editing}
          onSubmit={submit}
          pending={save.isPending}
        />
      )}
    </div>
  )
}
