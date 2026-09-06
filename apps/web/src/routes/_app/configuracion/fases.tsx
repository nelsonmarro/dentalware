import type { StageInput } from '@dentalware/shared'
import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { Stage } from '@/features/stages/api'
import { StageForm } from '@/features/stages/stage-form'
import { StagesTable } from '@/features/stages/stages-table'
import {
  useReorderStages,
  useSaveStage,
  useSetStageActive,
  useStages,
} from '@/features/stages/use-stages'

export const Route = createFileRoute('/_app/configuracion/fases')({ component: StagesPage })

function StagesPage() {
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<Stage | null | 'new'>(null)
  const stages = useStages(showInactive)
  // Se necesita la lista completa (activas e inactivas) para reordenar: la API exige
  // que el PUT /orden incluya exactamente todos los ids, aunque la tabla solo muestre
  // las activas cuando "Mostrar inactivas" está apagado.
  const allStages = useStages(true)
  const save = useSaveStage()
  const toggle = useSetStageActive()
  const reorder = useReorderStages()

  function submit(input: StageInput) {
    save.mutate(
      { id: editing && editing !== 'new' ? editing.id : undefined, input },
      { onSuccess: () => setEditing(null) },
    )
  }
  function move(s: Stage, dir: -1 | 1) {
    const ids = (allStages.data ?? []).map((x) => x.id)
    const i = ids.indexOf(s.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    reorder.mutate(ids)
  }
  const newButton = (
    <Button className="h-11" onClick={() => setEditing('new')}>
      <Plus className="size-4" /> Nueva fase
    </Button>
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fases de producción"
        description="El orden define el recorrido del trabajo dentro del laboratorio."
        action={newButton}
      />
      <div className="flex items-center gap-2">
        <Switch id="fases-inactivas" checked={showInactive} onCheckedChange={setShowInactive} />
        <Label htmlFor="fases-inactivas">Mostrar inactivas</Label>
      </div>
      {stages.isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <StagesTable
          stages={stages.data ?? []}
          onEdit={setEditing}
          onToggle={(s, active) => toggle.mutate({ id: s.id, active })}
          onMove={move}
          emptyAction={newButton}
        />
      )}
      {editing !== null && (
        <StageForm
          key={editing === 'new' ? 'new' : editing.id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          stage={editing === 'new' ? null : editing}
          onSubmit={submit}
          pending={save.isPending}
        />
      )}
    </div>
  )
}
