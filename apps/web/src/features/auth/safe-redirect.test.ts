import { describe, expect, it } from 'vitest'
import { safeRedirect } from './safe-redirect'

describe('safeRedirect', () => {
  it('acepta una ruta interna simple', () => {
    expect(safeRedirect('/trabajos')).toBe('/trabajos')
  })

  it('acepta una ruta interna con segmentos y query', () => {
    expect(safeRedirect('/t/26-00123?tab=fotos')).toBe('/t/26-00123?tab=fotos')
  })

  it('rechaza una URL absoluta http', () => {
    expect(safeRedirect('http://malo.example')).toBeNull()
  })

  it('rechaza una URL absoluta https', () => {
    expect(safeRedirect('https://malo.example')).toBeNull()
  })

  it('rechaza un protocol-relative //', () => {
    expect(safeRedirect('//malo.example')).toBeNull()
  })

  it('rechaza una ruta que empieza con /\\', () => {
    expect(safeRedirect('/\\malo.example')).toBeNull()
  })

  it('rechaza un esquema javascript:', () => {
    expect(safeRedirect('javascript:alert(1)')).toBeNull()
  })

  it('rechaza una cadena vacía', () => {
    expect(safeRedirect('')).toBeNull()
  })

  it('rechaza undefined', () => {
    expect(safeRedirect(undefined)).toBeNull()
  })

  it('rechaza una ruta que no empieza por /', () => {
    expect(safeRedirect('trabajos')).toBeNull()
  })
})
