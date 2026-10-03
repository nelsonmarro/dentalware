import type { UseQueryResult } from '@tanstack/react-query'
import { LoadError } from '@/components/load-error'
import type { Stage } from './api'
import { StagesTable } from './stages-table'

/**
 * Extraído de la ruta `configuracion/fases.tsx` (ronda de fixes 1, UX3-02, punto 3): mismo
 * criterio que `clinics-list.tsx` — la rama de carga/error/datos vive en `features/` para
 * poder probarse (`routes/` no tiene archivo de test en este proyecto).
 */
export function StagesList({
  stages,
  onEdit,
  onToggle,
  onMove,
  emptyAction,
}: {
  stages: UseQueryResult<Stage[]>
  onEdit: (s: Stage) => void
  onToggle: (s: Stage, active: boolean) => void
  onMove: (s: Stage, dir: -1 | 1) => void
  emptyAction?: React.ReactNode
}) {
  if (stages.isPending) return <p className="text-sm text-muted-foreground">Cargando…</p>
  if (stages.isError) return <LoadError onRetry={() => void stages.refetch()} />
  return (
    <StagesTable
      stages={stages.data ?? []}
      onEdit={onEdit}
      onToggle={onToggle}
      onMove={onMove}
      emptyAction={emptyAction}
    />
  )
}
