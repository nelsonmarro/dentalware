import type { CaseListQuery, CaseStatus, CaseView } from '@dentalware/shared'
import { caseListQuerySchema } from '@dentalware/shared'

export const CASE_VIEW_LABEL: Record<CaseView, string> = {
  nuevos: 'Nuevos',
  en_curso: 'En curso',
  vencen_hoy: 'Vencen hoy',
  atrasados: 'Atrasados',
  listos: 'Listos',
  todos: 'Todos',
}

/** Estados con fecha activa: los mismos que `ACTIVE_FOR_DATES` en la API (repo.ts). */
const ACTIVE_FOR_DATES: readonly CaseStatus[] = ['nuevo', 'en_proceso', 'en_espera', 'en_prueba']

/** Semáforo de fecha de entrega: `null` si no aplica (sin fecha, o el trabajo ya no está activo). */
export function dueBadge(
  date: string | null,
  today: string,
  status: CaseStatus,
): 'hoy' | 'atrasado' | null {
  if (!date || !ACTIVE_FOR_DATES.includes(status)) return null
  if (date === today) return 'hoy'
  if (date < today) return 'atrasado'
  return null
}

// `.partial()` deja cada campo opcional pero conserva sus validaciones (enum, uuid,
// coerce.number…); `.catch({})` evita que un parámetro corrupto en la URL (por ejemplo
// `?vista=x` o `?pagina=abc`) tumbe la ruta con el errorComponent del router: en ese
// caso se cae a `{}` (los defaults de la página) en vez de lanzar.
const casesSearchSchema = caseListQuerySchema.partial().catch({})

/** Valida `search` de `/trabajos`; parámetros inválidos caen a `{}` en vez de lanzar. */
export function parseCasesSearch(input: unknown): Partial<CaseListQuery> {
  return casesSearchSchema.parse(input)
}
