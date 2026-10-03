import { describe, expect, it } from 'vitest'
import { assertStorageKey } from './storage.ts'

describe('assertStorageKey', () => {
  it.each(['foto.jpg', 'trabajos/c1/3f2a.jpg', 'thumbs/3f2a.webp'])('acepta %j', (key) => {
    expect(() => assertStorageKey(key)).not.toThrow()
  })

  it.each([
    '',
    '../fuera.jpg',
    'a/../../b',
    '/etc/passwd',
    '\\\\servidor\\x',
    '..\\fuera',
    'C:\\x',
  ])('rechaza %j', (key) => {
    expect(() => assertStorageKey(key)).toThrow('Clave de almacenamiento inválida')
  })
})
