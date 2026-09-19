import { describe, expect, it } from 'vitest'
import { firstStage, isLastStage, nextStage, previousStage } from './stages.ts'

const stages = [
  { id: 'b', sort: 2, active: true },
  { id: 'a', sort: 1, active: true },
  { id: 'x', sort: 3, active: false },
  { id: 'c', sort: 4, active: true },
]

describe('fases', () => {
  it('la primera fase es la activa de menor orden', () => {
    expect(firstStage(stages)?.id).toBe('a')
  })

  it('avanza saltándose las fases inactivas', () => {
    expect(nextStage(stages, 'b')?.id).toBe('c')
  })

  it('retrocede saltándose las fases inactivas', () => {
    expect(previousStage(stages, 'c')?.id).toBe('b')
  })

  it('no hay siguiente desde la última fase activa', () => {
    expect(nextStage(stages, 'c')).toBeUndefined()
    expect(isLastStage(stages, 'c')).toBe(true)
  })

  it('no hay anterior desde la primera fase activa', () => {
    expect(previousStage(stages, 'a')).toBeUndefined()
  })

  it('una fase desconocida o nula no tiene siguiente ni anterior', () => {
    expect(nextStage(stages, 'desconocida')).toBeUndefined()
    expect(previousStage(stages, null)).toBeUndefined()
    expect(isLastStage(stages, null)).toBe(false)
  })

  it('sin fases activas no hay primera fase', () => {
    expect(firstStage([{ id: 'x', sort: 1, active: false }])).toBeUndefined()
  })
})
