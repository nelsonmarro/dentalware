import { describe, expect, it } from 'vitest'
import { AGING_TAB_COLOR, agingTab } from './aging-tab'

describe('agingTab y AGING_TAB_COLOR (la pestaña de color de una cuenta)', () => {
  it('sin nada pendiente es «al día»; si debe, el cubo de lo más antiguo', () => {
    expect(agingTab(null)).toBe('al_dia')
    expect(agingTab(0)).toBe('0_30')
    expect(agingTab(91)).toBe('90_mas')
  })

  // UX5-10: «Más de 90 días» tiene su propio tono, un vino casi negro, y no el rojo de error.
  it('cada cubo con su color: gris, ámbar, rojo y vino para «Más de 90 días»', () => {
    expect(AGING_TAB_COLOR).toEqual({
      al_dia: 'var(--border)',
      '0_30': 'var(--muted-foreground)',
      '31_60': 'var(--wax-amber)',
      '61_90': 'var(--articulating-red)',
      '90_mas': 'var(--overdue-wine)',
    })
  })
})
