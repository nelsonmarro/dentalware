import { toothLabel } from '@dentalware/shared'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { TeethDialog } from './teeth-dialog'

describe('TeethDialog', () => {
  it('abre con el valor dado y muestra el contador en singular', () => {
    renderWithProviders(
      <TeethDialog open value={[11]} onOpenChange={() => {}} onSave={() => {}} title="Piezas" />,
    )
    expect(screen.getByText('1 pieza')).toBeInTheDocument()
  })

  it('el contador pasa a plural al agregar una pieza', async () => {
    const { user } = renderWithProviders(
      <TeethDialog open value={[11]} onOpenChange={() => {}} onSave={() => {}} title="Piezas" />,
    )
    await user.click(screen.getByRole('button', { name: toothLabel(12) }))
    expect(screen.getByText('2 piezas')).toBeInTheDocument()
  })

  it('"Guardar" llama a onSave con el borrador y cierra el diálogo', async () => {
    const onSave = vi.fn()
    const onOpenChange = vi.fn()
    const { user } = renderWithProviders(
      <TeethDialog open value={[11]} onOpenChange={onOpenChange} onSave={onSave} title="Piezas" />,
    )
    await user.click(screen.getByRole('button', { name: toothLabel(12) }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSave).toHaveBeenCalledWith([11, 12])
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('"Cancelar" descarta los cambios del borrador', async () => {
    const onSave = vi.fn()
    const onOpenChange = vi.fn()
    const { user } = renderWithProviders(
      <TeethDialog open value={[11]} onOpenChange={onOpenChange} onSave={onSave} title="Piezas" />,
    )
    await user.click(screen.getByRole('button', { name: toothLabel(12) }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
