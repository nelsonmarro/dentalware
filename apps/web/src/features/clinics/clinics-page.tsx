import type { ClinicInput } from '@dentalware/shared'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { Clinic } from './api'
import { ClinicForm } from './clinic-form'
import { ClinicsList } from './clinics-list'
import { useClinics, useSaveClinic, useSetClinicActive } from './use-clinics'

/** Pantalla «Clínicas». `editId` (de `?editar=` en la URL, AVI-4) abre el diálogo de esa clínica
 * una sola vez, en cuanto carga la lista; `onEditHandled` avisa para que la ruta lo quite de la
 * URL, exista o no la clínica. */
export function ClinicsPage({
  editId,
  onEditHandled,
}: {
  editId?: string
  onEditHandled: () => void
}) {
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<Clinic | null | 'new'>(null)
  const clinics = useClinics(showInactive)
  const save = useSaveClinic()
  const toggle = useSetClinicActive()

  // Ajuste de estado durante el render (no en un efecto): abre el diálogo una sola vez por `editId`.
  const list = clinics.data
  const [opened, setOpened] = useState<string | undefined>()
  if (editId && list && opened !== editId) {
    setOpened(editId)
    const target = list.find((c) => c.id === editId)
    if (target) setEditing(target)
  }
  useEffect(() => {
    if (editId && list) onEditHandled()
  }, [editId, list, onEditHandled])

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
      <ClinicsList
        clinics={clinics}
        onEdit={setEditing}
        onToggle={(c, active) => toggle.mutate({ id: c.id, active })}
        emptyAction={newButton}
      />
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
