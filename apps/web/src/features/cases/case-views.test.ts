import { CASE_STATUSES, CASE_VIEWS } from '@dentalware/shared'
import { describe, expect, it } from 'vitest'
import { CASE_VIEW_LABEL, dueBadge, isStageVisible, parseCasesSearch } from './case-views'

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

describe('isStageVisible', () => {
  // M-3, ola de fixes del PR 1 (lote B): `finalizar`/`cancelar` no limpian `currentStageId`,
  // así que la API sigue devolviendo una fase para un trabajo terminado/entregado/cancelado.
  // La ficha la oculta fuera de los tres estados en los que la fase tiene sentido: durante la
  // producción (`en_proceso`), en pausa (`en_espera`, la fase queda congelada, no perdida) y
  // en una prueba en boca (`en_prueba`, el trabajo sigue en esa fase mientras se prueba).
  it('se muestra en en_proceso, en_espera y en_prueba', () => {
    expect(isStageVisible('en_proceso')).toBe(true)
    expect(isStageVisible('en_espera')).toBe(true)
    expect(isStageVisible('en_prueba')).toBe(true)
  })

  it('se oculta en nuevo y en los estados terminales', () => {
    expect(isStageVisible('nuevo')).toBe(false)
    expect(isStageVisible('terminado')).toBe(false)
    expect(isStageVisible('enviado')).toBe(false)
    expect(isStageVisible('entregado')).toBe(false)
    expect(isStageVisible('cancelado')).toBe(false)
  })

  it('cubre todos los estados de CASE_STATUSES (exhaustivo)', () => {
    for (const status of CASE_STATUSES) {
      expect(typeof isStageVisible(status)).toBe('boolean')
    }
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
