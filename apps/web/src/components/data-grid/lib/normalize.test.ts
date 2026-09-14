import { describe, expect, it } from 'vitest'
import { normalize } from './normalize'

describe('normalize', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(normalize('Híbrida')).toBe('hibrida')
    expect(normalize('GÓMEZ')).toBe('gomez')
  })
  it('tolera valores no textuales', () => {
    expect(normalize(12)).toBe('12')
    expect(normalize(null)).toBe('')
    expect(normalize(undefined)).toBe('')
  })
})
