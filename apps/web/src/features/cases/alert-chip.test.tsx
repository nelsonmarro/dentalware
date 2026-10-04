import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AlertChip } from './alert-chip'

/**
 * Ronda de fixes 1 de la Tarea 1 (Important): `AlertChip` reemplaza los `PriorityChip`/
 * `DueChip` de `cases-table.tsx` y los dos `<span>` inline de `my-cases.tsx`, que repetían
 * las mismas clases Tailwind por su cuenta. Este test protege las dos cosas que importan de
 * cada variante: el texto queda visible (no solo un icono/color) y la tinta es la correcta
 * (`text-destructive` o `--wax-amber-ink`, ya verificada en AA/3:1 por `theme-tokens.test.ts`).
 */
describe('AlertChip', () => {
  it('muestra el texto que recibe como hijo', () => {
    render(<AlertChip tone="destructive">Atrasado</AlertChip>)
    expect(screen.getByText('Atrasado')).toBeInTheDocument()
  })

  it('tone="destructive" usa text-destructive (p. ej. "Urgente"/"Atrasado")', () => {
    render(<AlertChip tone="destructive">Urgente</AlertChip>)
    expect(screen.getByText('Urgente').className).toContain('text-destructive')
  })

  it('tone="amber" usa la tinta --wax-amber-ink, no --wax-amber (UX3-01)', () => {
    render(<AlertChip tone="amber">Vence hoy</AlertChip>)
    const chip = screen.getByText('Vence hoy')
    expect(chip.className).toContain('wax-amber-ink')
    expect(chip.className).not.toContain('text-[color:var(--wax-amber)]')
  })
})
