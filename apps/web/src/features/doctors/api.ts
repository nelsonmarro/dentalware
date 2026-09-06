import type { DoctorInput } from '@dentalware/shared'
import { api } from '@/lib/api'
import { throwIfNotOk } from '@/lib/api-error'

const doctores = api.api.config.doctores
export async function fetchDoctors(clinicId: string, inactive: boolean) {
  const res = await throwIfNotOk(
    await doctores.$get({ query: { clinicId, incluirInactivos: inactive ? 'true' : 'false' } }),
  )
  return (await res.json()).doctors
}
export type Doctor = Awaited<ReturnType<typeof fetchDoctors>>[number]
export async function createDoctor(input: DoctorInput) {
  return (await (await throwIfNotOk(await doctores.$post({ json: input }))).json()).doctor
}
export async function updateDoctor(id: string, input: DoctorInput) {
  return (
    await (await throwIfNotOk(await doctores[':id'].$put({ param: { id }, json: input }))).json()
  ).doctor
}
export async function setDoctorActive(id: string, active: boolean) {
  return (
    await (
      await throwIfNotOk(await doctores[':id'].activo.$patch({ param: { id }, json: { active } }))
    ).json()
  ).doctor
}
