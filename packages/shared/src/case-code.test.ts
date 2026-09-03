import { describe, expect, it } from 'vitest'
import { CASE_CODE_REGEX, formatCaseCode, parseCaseCode } from './case-code.ts'

describe('código de trabajo', () => {
  it('formatea AA-NNNNN', () => {
    expect(formatCaseCode(2026, 123)).toBe('26-00123')
    expect(formatCaseCode(2030, 1)).toBe('30-00001')
  })

  it('parsea', () => {
    expect(parseCaseCode('26-00123')).toEqual({ year: 2026, seq: 123 })
    expect(parseCaseCode('26-123')).toBeNull()
    expect(parseCaseCode('abc')).toBeNull()
  })

  it('regex', () => {
    expect(CASE_CODE_REGEX.test('26-00123')).toBe(true)
    expect(CASE_CODE_REGEX.test('2026-00123')).toBe(false)
  })

  it('rechaza secuencias fuera de rango', () => {
    expect(() => formatCaseCode(2026, 0)).toThrow()
    expect(() => formatCaseCode(2026, 100000)).toThrow()
  })
})
