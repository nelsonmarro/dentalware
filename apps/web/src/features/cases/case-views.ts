import type { CaseStatus, CaseView } from '@dentalware/shared'

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
