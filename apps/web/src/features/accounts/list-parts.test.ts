import { describe, expect, it } from 'vitest'
import { listParts } from './list-parts'

describe('listParts', () => {
  it('intercala los separadores del español entre los elementos, sin tocarlos', () => {
    const a = { id: 'a' }
    const b = { id: 'b' }
    const c = { id: 'c' }
    expect(listParts([a])).toEqual([a])
    expect(listParts([a, b])).toEqual([a, ' y ', b])
    expect(listParts([a, b, c])).toEqual([a, ', ', b, ' y ', c])
    expect(listParts([])).toEqual([])
  })
})
