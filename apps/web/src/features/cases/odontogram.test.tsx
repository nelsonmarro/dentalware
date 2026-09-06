import { FDI_TEETH, toothLabel } from '@dentalware/shared'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { Odontogram } from './odontogram'

function toothButtons() {
  return screen
    .getAllByRole('button')
    .filter((b) => /^\d+ ·/.test(b.getAttribute('aria-label') ?? ''))
}

describe('Odontogram', () => {
  it('renderiza las 32 piezas en el orden de lectura del odontograma', () => {
    renderWithProviders(<Odontogram value={[]} />)

    const buttons = toothButtons()
    expect(buttons).toHaveLength(32)
    expect(buttons.map((b) => Number(b.getAttribute('aria-label')?.split(' · ')[0]))).toEqual([
      ...FDI_TEETH,
    ])
    for (const b of buttons) {
      expect(b).toHaveAttribute('aria-pressed', 'false')
    }
    for (const n of FDI_TEETH) {
      expect(screen.getByRole('button', { name: toothLabel(n) })).toBeInTheDocument()
    }
  })

  it('clic en una pieza la selecciona y clic de nuevo la deselecciona', async () => {
    const onChange = vi.fn()
    const { user, rerender } = renderWithProviders(<Odontogram value={[]} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: toothLabel(11) }))
    expect(onChange).toHaveBeenLastCalledWith([11])

    rerender(<Odontogram value={[11]} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: toothLabel(11) }))
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('agrega una pieza al valor existente y lo mantiene ordenado', async () => {
    const onChange = vi.fn()
    const { user } = renderWithProviders(<Odontogram value={[11]} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: toothLabel(12) }))
    expect(onChange).toHaveBeenLastCalledWith([11, 12])
  })

  it('"Arcada superior" selecciona las 16 piezas superiores', async () => {
    const onChange = vi.fn()
    const { user } = renderWithProviders(<Odontogram value={[]} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Arcada superior' }))
    const upper = [11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28]
    expect(onChange).toHaveBeenLastCalledWith(upper)
  })

  it('con la arcada superior completa seleccionada, "Arcada superior" la limpia y conserva la inferior', async () => {
    const onChange = vi.fn()
    const { user } = renderWithProviders(
      <Odontogram
        value={[11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31]}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Arcada superior' }))
    expect(onChange).toHaveBeenLastCalledWith([31])
  })

  it('con una selección superior parcial, "Arcada superior" completa las 16 piezas', async () => {
    const onChange = vi.fn()
    const { user } = renderWithProviders(<Odontogram value={[11]} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Arcada superior' }))
    const upper = [11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28]
    expect(onChange).toHaveBeenLastCalledWith(upper)
  })

  it('"Limpiar" llama a onChange con un arreglo vacío', async () => {
    const onChange = vi.fn()
    const { user } = renderWithProviders(<Odontogram value={[11, 12]} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('readOnly deshabilita los botones y refleja la selección', () => {
    renderWithProviders(<Odontogram value={[11, 48]} readOnly />)

    expect(screen.getByRole('button', { name: toothLabel(11) })).toBeDisabled()
    expect(screen.getByRole('button', { name: toothLabel(11) })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: toothLabel(48) })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: toothLabel(21) })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.queryByRole('button', { name: 'Limpiar' })).not.toBeInTheDocument()
  })

  it('el teclado (Enter/Espacio) alterna la selección de una pieza', async () => {
    const onChange = vi.fn()
    const { user } = renderWithProviders(<Odontogram value={[]} onChange={onChange} />)

    const button = screen.getByRole('button', { name: toothLabel(11) })
    button.focus()
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenLastCalledWith([11])
  })
})
