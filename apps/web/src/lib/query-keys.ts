import type { CaseListQueryInput } from '@/features/cases/api'

export const queryKeys = {
  health: ['health'] as const,
  labSettings: ['config', 'laboratorio'] as const,
  clinics: (inactive: boolean) => ['config', 'clinicas', { inactive }] as const,
  clinic: (id: string) => ['config', 'clinicas', id] as const,
  doctors: (clinicId?: string, inactive = false) =>
    ['config', 'doctores', { clinicId, inactive }] as const,
  categories: (inactive: boolean) => ['config', 'categorias', { inactive }] as const,
  products: (inactive: boolean) => ['config', 'productos', { inactive }] as const,
  clinicPrices: (clinicId: string) => ['config', 'precios', clinicId] as const,
  stages: (inactive: boolean) => ['config', 'fases', { inactive }] as const,
  users: ['users'] as const,
  cases: (query: CaseListQueryInput) => ['trabajos', 'lista', query] as const,
  case: (id: string) => ['trabajos', id] as const,
  // Bajo el prefijo `users`, no `trabajos` (M-7, ola de fixes del PR 1, lote B): son los
  // técnicos activos (`GET /api/trabajos/tecnicos`, dato de la feature `users`, no de
  // `cases`) que llenan el `<select>` de `TechnicianSelect`. Con el prefijo viejo, una alta/
  // edición/baja de usuario (`useInvalidateUsers`, invalida `['users']`) no lo tocaba —dar de
  // baja a un técnico no refrescaba el selector, que lo seguía ofreciendo hasta la próxima
  // mutación de un trabajo— y en cambio cualquier mutación de trabajo sí lo invalidaba sin
  // necesidad (la lista de técnicos no cambia por aceptar o finalizar un trabajo). Al vivir
  // bajo `['users']`, `qc.invalidateQueries({ queryKey: queryKeys.users })` ya lo alcanza por
  // coincidencia de prefijo (comportamiento por defecto de TanStack Query, `exact: false`):
  // no hace falta invalidarlo aparte en cada mutación de `use-users.ts`.
  caseTechnicians: ['users', 'tecnicos'] as const,
  caseEvents: (id: string) => ['trabajos', id, 'eventos'] as const,
  attachments: (caseId: string) => ['trabajos', caseId, 'adjuntos'] as const,
}
