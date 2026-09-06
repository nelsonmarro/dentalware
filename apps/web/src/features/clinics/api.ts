import type { ClinicInput } from '@dentalware/shared'
import { api } from '@/lib/api'
import { throwIfNotOk } from '@/lib/api-error'

const clinicas = api.api.config.clinicas
export async function fetchClinics(inactive: boolean) {
  const res = await throwIfNotOk(
    await clinicas.$get({ query: { incluirInactivos: inactive ? 'true' : 'false' } }),
  )
  return (await res.json()).clinics
}
export type Clinic = Awaited<ReturnType<typeof fetchClinics>>[number]
export async function fetchClinic(id: string) {
  return (await (await throwIfNotOk(await clinicas[':id'].$get({ param: { id } }))).json()).clinic
}
export type ClinicDetail = Awaited<ReturnType<typeof fetchClinic>>
export async function createClinic(input: ClinicInput) {
  return (await (await throwIfNotOk(await clinicas.$post({ json: input }))).json()).clinic
}
export async function updateClinic(id: string, input: ClinicInput) {
  return (
    await (await throwIfNotOk(await clinicas[':id'].$put({ param: { id }, json: input }))).json()
  ).clinic
}
export async function setClinicActive(id: string, active: boolean) {
  return (
    await (
      await throwIfNotOk(await clinicas[':id'].activo.$patch({ param: { id }, json: { active } }))
    ).json()
  ).clinic
}
