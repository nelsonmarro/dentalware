import type { CaseInput, CaseListQuery } from '@dentalware/shared'
import { api } from '@/lib/api'
import { throwIfNotOk } from '@/lib/api-error'

const trabajos = api.api.trabajos

/** Todos los campos de `caseListQuerySchema` son opcionales aquí: la API aplica sus defaults. */
export type CaseListQueryInput = Partial<CaseListQuery>

/** Serializa solo las claves definidas de la búsqueda a `query: Record<string,string>`. */
function toQuery(query: CaseListQueryInput): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    out[key] = String(value)
  }
  return out
}

export async function fetchCases(query: CaseListQueryInput) {
  return await (await throwIfNotOk(await trabajos.$get({ query: toQuery(query) }))).json()
}
export type CaseListResult = Awaited<ReturnType<typeof fetchCases>>
export type CaseListRow = CaseListResult['cases'][number]

export async function fetchCase(id: string) {
  return await (await throwIfNotOk(await trabajos[':id'].$get({ param: { id } }))).json()
}
export type CaseDetail = Awaited<ReturnType<typeof fetchCase>>['case']

export async function createCase(input: CaseInput) {
  return (await (await throwIfNotOk(await trabajos.$post({ json: input }))).json()).case
}

export async function updateCase(id: string, input: CaseInput) {
  return (
    await (await throwIfNotOk(await trabajos[':id'].$put({ param: { id }, json: input }))).json()
  ).case
}

export async function fetchEvents(id: string) {
  return (await (await throwIfNotOk(await trabajos[':id'].eventos.$get({ param: { id } }))).json())
    .events
}
export type CaseEvent = Awaited<ReturnType<typeof fetchEvents>>[number]

export async function postComment(id: string, text: string) {
  return (
    await (
      await throwIfNotOk(await trabajos[':id'].comentarios.$post({ param: { id }, json: { text } }))
    ).json()
  ).event
}
