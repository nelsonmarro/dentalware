import { describe, expect, it } from 'vitest'
import type { Stage } from '@/features/stages/api'
import { stageNavigation } from './stage-navigation'

function stage(id: string, sort: number, active = true): Stage {
  return { id, name: id.toUpperCase(), sort, active } as unknown as Stage
}

const fases = [stage('f1', 0), stage('f2', 1), stage('f3', 2)]

describe('stageNavigation', () => {
  it('en una fase intermedia conoce la siguiente y la anterior', () => {
    const nav = stageNavigation(fases, 'f2')
    expect(nav.loading).toBe(false)
    expect(nav.current?.id).toBe('f2')
    expect(nav.next?.id).toBe('f3')
    expect(nav.previous?.id).toBe('f1')
    expect(nav.last).toBe(false)
  })

  // UX3-27: la ficha corta rotula «Avanzar a {fase siguiente}»; la siguiente es la fase completa
  // (con nombre), no solo la referencia de `nextStage`.
  it('la fase siguiente trae su nombre', () => {
    expect(stageNavigation(fases, 'f1').next?.name).toBe('F2')
  })

  it('en la última fase no hay siguiente y es la última', () => {
    const nav = stageNavigation(fases, 'f3')
    expect(nav.next).toBeUndefined()
    expect(nav.last).toBe(true)
  })

  it('sin fases y sin error está cargando, sin siguiente conocida', () => {
    const nav = stageNavigation([], 'f1')
    expect(nav.loading).toBe(true)
    expect(nav.next).toBeUndefined()
    expect(nav.last).toBe(false)
  })

  it('con error al cargar las fases no está cargando ni conoce la siguiente', () => {
    const nav = stageNavigation([], 'f1', true)
    expect(nav.loading).toBe(false)
    expect(nav.next).toBeUndefined()
    expect(nav.last).toBe(false)
  })

  it('con la fase actual desactivada la reconoce, pero no hay siguiente ni es la última', () => {
    const nav = stageNavigation([stage('f1', 0), stage('f2', 1, false), stage('f3', 2)], 'f2')
    expect(nav.current?.id).toBe('f2')
    expect(nav.currentInactive).toBe(true)
    expect(nav.next).toBeUndefined()
    expect(nav.last).toBe(false)
  })
})
