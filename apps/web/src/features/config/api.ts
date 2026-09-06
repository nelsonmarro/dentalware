import type { LabSettingsInput } from '@dentalware/shared'
import { api } from '@/lib/api'
import { throwIfNotOk } from '@/lib/api-error'

export async function fetchLabSettings() {
  const res = await throwIfNotOk(await api.api.config.laboratorio.$get())
  return (await res.json()).settings
}
export type LabSettings = NonNullable<Awaited<ReturnType<typeof fetchLabSettings>>>

export async function saveLabSettings(input: LabSettingsInput) {
  const res = await throwIfNotOk(await api.api.config.laboratorio.$put({ json: input }))
  return (await res.json()).settings
}
