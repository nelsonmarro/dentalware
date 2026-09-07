import { describe, expect, it } from 'vitest'
import { STAGES } from './seed-data.ts'

describe('STAGES (colores del seed de fases)', () => {
  it('trae 7 fases', () => {
    expect(STAGES).toHaveLength(7)
  })

  it('ninguna fase usa el teal primario (#0F766E), reservado para la acción principal', () => {
    for (const [name, color] of STAGES) {
      expect(color.toUpperCase(), `${name} no debería usar el color primario`).not.toBe('#0F766E')
    }
  })

  it('todas las fases tienen colores distintos entre sí (UX1-06)', () => {
    const colors = STAGES.map(([, color]) => color.toUpperCase())
    expect(new Set(colors).size).toBe(colors.length)
  })
})
