import type { ClinicInput } from '@dentalware/shared'
import { Plus } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { isNotFoundError, toastApiError } from '@/lib/api-error'
import type { Clinic } from './api'
import { ClinicForm } from './clinic-form'
import { ClinicsList } from './clinics-list'
import { useClinic, useClinics, useSaveClinic, useSetClinicActive } from './use-clinics'

/** Pantalla «Clínicas». `editId` (de `?editar=` en la URL, AVI-4) abre el diálogo de esa clínica
 * una sola vez: la busca en la lista y, si no está (inactiva), la pide por id; si no existe, lo
 * avisa. `onEditHandled` avisa para que la ruta lo quite de la URL. `returnTo` (`?volver=`, la
 * ficha del trabajo) es adonde se regresa al guardar o cancelar, y `focusField` (`?campo=`) el
 * campo que recibe el foco (UX7-01). */
export function ClinicsPage({
  editId,
  returnTo = null,
  focusField = null,
  onEditHandled,
}: {
  editId?: string
  returnTo?: string | null
  focusField?: 'whatsapp' | null
  onEditHandled: () => void
}) {
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<Clinic | null | 'new'>(null)
  const [request, setRequest] = useState<{
    returnTo: string | null
    field: 'whatsapp' | null
  } | null>(null)
  const [lookupId, setLookupId] = useState<string | null>(null)
  const clinics = useClinics(showInactive)
  const lookup = useClinic(lookupId ?? '', lookupId !== null)
  const save = useSaveClinic()
  const toggle = useSetClinicActive()
  const navigate = useNavigate()

  // Ajuste de estado durante el render (no en un efecto): abre el diálogo una sola vez por `editId`.
  const list = clinics.data
  const [opened, setOpened] = useState<string | undefined>()
  if (!editId && opened) setOpened(undefined)
  if (editId && list && opened !== editId) {
    setOpened(editId)
    setRequest({ returnTo, field: focusField })
    const target = list.find((c) => c.id === editId)
    if (target) setEditing(target)
    else setLookupId(editId)
  }
  useEffect(() => {
    if (editId && list) onEditHandled()
  }, [editId, list, onEditHandled])
  // La clínica que no está en la lista (inactiva) se pide por id: al llegar, abre el diálogo.
  if (lookupId !== null && lookup.data) {
    setEditing(lookup.data)
    setLookupId(null)
  }
  // Si no existe (404) o falla, se avisa una vez; no se abre nada.
  useEffect(() => {
    if (lookupId === null || !lookup.isError) return
    if (isNotFoundError(lookup.error)) toast.error('Esa clínica ya no existe')
    else toastApiError(lookup.error)
  }, [lookupId, lookup.isError, lookup.error])

  function leave(href: string | null) {
    setEditing(null)
    if (href) void navigate({ href })
    setRequest(null)
  }
  function submit(input: ClinicInput) {
    const doneText =
      request?.field === 'whatsapp' && input.whatsapp
        ? `WhatsApp de ${input.name} guardado`
        : undefined
    save.mutate(
      { id: editing && editing !== 'new' ? editing.id : undefined, input, doneText },
      {
        onSuccess: () =>
          leave(
            request?.returnTo ? `${request.returnTo}${doneText ? '?foco=whatsapp' : ''}` : null,
          ),
      },
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
          onOpenChange={(o) => !o && leave(request?.returnTo ?? null)}
          clinic={editing === 'new' ? null : editing}
          onSubmit={submit}
          pending={save.isPending}
          focusField={request?.field ?? null}
        />
      )}
    </div>
  )
}
