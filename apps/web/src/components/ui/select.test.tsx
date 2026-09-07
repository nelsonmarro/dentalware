import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

describe('SelectTrigger', () => {
  it('sin size mide 44 px de alto (h-11) y no lleva h-8', () => {
    render(
      <Select>
        <SelectTrigger aria-label="Clínica">
          <SelectValue placeholder="Elegí una clínica" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Clínica A</SelectItem>
        </SelectContent>
      </Select>,
    )
    const trigger = screen.getByRole('combobox', { name: 'Clínica' })
    expect(trigger.className).toContain('h-11')
    expect(trigger.className).not.toMatch(/(?<!pointer-coarse:)\bh-8\b/)
  })

  it('size="sm" llega a 44 px en dispositivos táctiles (pointer-coarse:h-11)', () => {
    render(
      <Select>
        <SelectTrigger size="sm" aria-label="Filtro">
          <SelectValue placeholder="Elegí" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    )
    const trigger = screen.getByRole('combobox', { name: 'Filtro' })
    expect(trigger.className).toContain('pointer-coarse:h-11')
  })
})
