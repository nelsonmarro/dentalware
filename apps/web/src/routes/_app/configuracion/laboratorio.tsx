import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/page-header'
import { LabSettingsContent } from '@/features/config/lab-settings-content'
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
      <LabSettingsContent
        settings={settings}
        onSubmit={(v) => save.mutate(v)}
        pending={save.isPending}
      />
    </div>
  )
}
