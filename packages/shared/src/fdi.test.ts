import { describe, expect, it } from 'vitest'
import { FDI_QUADRANTS, FDI_TEETH, fdiTeethSchema, isFdiTooth, toothLabel } from './fdi.ts'

describe('FDI', () => {
  it('tiene 32 piezas permanentes en orden de cuadrante', () => {
    expect(FDI_TEETH).toHaveLength(32)
    expect(FDI_TEETH.slice(0, 8)).toEqual([18, 17, 16, 15, 14, 13, 12, 11])
    expect(FDI_TEETH.slice(8, 16)).toEqual([21, 22, 23, 24, 25, 26, 27, 28])
    expect(FDI_TEETH.slice(16, 24)).toEqual([48, 47, 46, 45, 44, 43, 42, 41])
    expect(FDI_TEETH.slice(24, 32)).toEqual([31, 32, 33, 34, 35, 36, 37, 38])
  })

  it('agrupa por cuadrante', () => {
    expect(FDI_QUADRANTS[1]).toEqual([18, 17, 16, 15, 14, 13, 12, 11])
    expect(FDI_QUADRANTS[3]).toEqual([31, 32, 33, 34, 35, 36, 37, 38])
  })

  it('valida piezas', () => {
    expect(isFdiTooth(11)).toBe(true)
    expect(isFdiTooth(48)).toBe(true)
    expect(isFdiTooth(19)).toBe(false)
    expect(isFdiTooth(10)).toBe(false)
    expect(isFdiTooth(51)).toBe(false) // temporales fuera del MVP
    expect(isFdiTooth('11')).toBe(false)
  })

  it('etiqueta legible', () => {
    expect(toothLabel(11)).toBe('11 · Incisivo central superior derecho')
    expect(toothLabel(36)).toBe('36 · Primer molar inferior izquierdo')
  })

  it('schema zod: ordena y rechaza duplicados o piezas inválidas', () => {
    expect(fdiTeethSchema.parse([44, 42, 43])).toEqual([42, 43, 44])
    expect(fdiTeethSchema.safeParse([11, 11]).success).toBe(false)
    expect(fdiTeethSchema.safeParse([99]).success).toBe(false)
  })
})
