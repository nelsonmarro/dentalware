import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/page-header'
import { LabSettingsForm } from '@/features/config/lab-settings-form'
import { useLabSettings, useSaveLabSettings } from '@/features/config/use-lab-settings'

export const Route = createFileRoute('/_app/configuracion/laboratorio')({
  component: LabSettingsPage,
})

function LabSettingsPage() {
  const settings = useLabSettings()
  const save = useSaveLabSettings()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Laboratorio"
        description="Datos que aparecen en las fichas impresas y en los avisos a las clínicas."
      />
      {settings.isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <LabSettingsForm
          key={settings.data?.id ?? 'new'}
          initial={settings.data ?? null}
          onSubmit={(v) => save.mutate(v)}
          pending={save.isPending}
        />
      )}
    </div>
  )
}
