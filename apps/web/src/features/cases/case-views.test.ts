import { CASE_VIEWS } from '@dentalware/shared'
import { describe, expect, it } from 'vitest'
import { CASE_VIEW_LABEL, dueBadge, parseCasesSearch } from './case-views'

describe('CASE_VIEW_LABEL', () => {
  it('cubre todas las vistas de CASE_VIEWS', () => {
    for (const view of CASE_VIEWS) {
      expect(CASE_VIEW_LABEL[view]).toBeTruthy()
    }
  })
})

describe('dueBadge', () => {
  it('marca "hoy" cuando la fecha coincide con hoy y el trabajo sigue activo', () => {
    expect(dueBadge('2026-09-06', '2026-09-06', 'nuevo')).toBe('hoy')
  })

  it('marca "atrasado" cuando la fecha ya pasó y el trabajo sigue activo', () => {
    expect(dueBadge('2026-09-01', '2026-09-06', 'en_proceso')).toBe('atrasado')
  })

  it('no marca nada si el trabajo ya se entregó', () => {
    expect(dueBadge('2026-09-01', '2026-09-06', 'entregado')).toBeNull()
  })

  it('no marca nada sin fecha', () => {
    expect(dueBadge(null, '2026-09-06', 'nuevo')).toBeNull()
  })
})

describe('parseCasesSearch', () => {
  it('acepta parámetros válidos y coerciona pagina a número', () => {
    expect(parseCasesSearch({ vista: 'atrasados', pagina: '2' })).toEqual({
      vista: 'atrasados',
      pagina: 2,
    })
  })

  it('cae a {} cuando algún parámetro es inválido, en vez de lanzar', () => {
    expect(parseCasesSearch({ vista: 'x', pagina: 'abc' })).toEqual({})
  })

  it('no lanza con entradas arbitrarias (undefined, null, arreglos)', () => {
    expect(parseCasesSearch(undefined)).toEqual({})
    expect(parseCasesSearch(null)).toEqual({})
    expect(parseCasesSearch({ clinicId: 'no-uuid' })).toEqual({})
  })
})
