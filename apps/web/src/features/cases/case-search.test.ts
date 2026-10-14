import { describe, expect, it } from 'vitest'
import { parseCaseSearch } from './case-search'

describe('parseCaseSearch (search de /trabajos/$caseId)', () => {
  it('acepta foco=whatsapp', () => {
    expect(parseCaseSearch({ foco: 'whatsapp' })).toEqual({ foco: 'whatsapp' })
  })
  it.each([{ foco: 'otro' }, { foco: 1 }, 'basura', null, {}])('descarta %j', (input) => {
    expect(parseCaseSearch(input)).toEqual({})
  })
})
