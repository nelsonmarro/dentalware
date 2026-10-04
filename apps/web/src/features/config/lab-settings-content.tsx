import type { LabSettingsInput } from '@dentalware/shared'
import type { UseQueryResult } from '@tanstack/react-query'
import { LoadError } from '@/components/load-error'
import type { LabSettings } from './api'
import { LabSettingsForm } from './lab-settings-form'

/**
 * Extraído de la ruta `configuracion/laboratorio.tsx` (ronda de fixes 1, UX3-02, punto 3):
 * mismo criterio que `clinics-list.tsx`. `settings.data === null` es un caso válido (el
 * laboratorio aún no configuró sus datos, `LabSettingsForm` lo recibe como formulario vacío);
 * `settings.isError` es otra cosa — un fallo de red, no "sin configurar".
 */
export function LabSettingsContent({
  settings,
  onSubmit,
  pending,
}: {
  settings: UseQueryResult<LabSettings | null>
  onSubmit: (v: LabSettingsInput) => void
  pending: boolean
}) {
  if (settings.isPending) return <p className="text-sm text-muted-foreground">Cargando…</p>
  if (settings.isError) return <LoadError onRetry={() => void settings.refetch()} />
  return (
    <LabSettingsForm
      key={settings.data?.id ?? 'new'}
      initial={settings.data ?? null}
      onSubmit={onSubmit}
      pending={pending}
    />
  )
}
