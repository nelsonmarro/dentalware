import type { UseQueryResult } from '@tanstack/react-query'
import { LoadError } from '@/components/load-error'
import type { Clinic } from './api'
import { ClinicsTable } from './clinics-table'

/**
 * Extraído de la ruta `configuracion/clinicas.tsx` (ronda de fixes 1, UX3-02, punto 3): las
 * rutas no llevan lógica y `routes/` no tiene archivo de test en este proyecto (mismo criterio
 * que `home-summary.tsx`), así que la rama de carga/error/datos vive aquí, donde se puede
 * probar. Un fallo de red mostraba la tabla vacía (sin clínicas) en vez de un error que se
 * pueda reintentar.
 */
export function ClinicsList({
  clinics,
  onEdit,
  onToggle,
  emptyAction,
}: {
  clinics: UseQueryResult<Clinic[]>
  onEdit: (c: Clinic) => void
  onToggle: (c: Clinic, active: boolean) => void
  emptyAction?: React.ReactNode
}) {
  if (clinics.isPending) return <p className="text-sm text-muted-foreground">Cargando…</p>
  if (clinics.isError) return <LoadError onRetry={() => void clinics.refetch()} />
  return (
    <ClinicsTable
      clinics={clinics.data ?? []}
      onEdit={onEdit}
      onToggle={onToggle}
      emptyAction={emptyAction}
    />
  )
}
