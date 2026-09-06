import type { StageInput } from '@dentalware/shared'
import { api } from '@/lib/api'
import { throwIfNotOk } from '@/lib/api-error'

const fases = api.api.config.fases
export async function fetchStages(inactive: boolean) {
  const res = await throwIfNotOk(
    await fases.$get({ query: { incluirInactivos: inactive ? 'true' : 'false' } }),
  )
  return (await res.json()).stages
}
export type Stage = Awaited<ReturnType<typeof fetchStages>>[number]
export async function createStage(input: StageInput) {
  return (await (await throwIfNotOk(await fases.$post({ json: input }))).json()).stage
}
export async function updateStage(id: string, input: StageInput) {
  return (
    await (await throwIfNotOk(await fases[':id'].$put({ param: { id }, json: input }))).json()
  ).stage
}
export async function setStageActive(id: string, active: boolean) {
  return (
    await (
      await throwIfNotOk(await fases[':id'].activo.$patch({ param: { id }, json: { active } }))
    ).json()
  ).stage
}
export async function reorderStages(ids: string[]) {
  return (await (await throwIfNotOk(await fases.orden.$put({ json: { ids } }))).json()).stages
}
