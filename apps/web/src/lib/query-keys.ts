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
  caseEvents: (id: string) => ['trabajos', id, 'eventos'] as const,
  attachments: (caseId: string) => ['trabajos', caseId, 'adjuntos'] as const,
}
