import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './confirm-dialog'

describe('ConfirmDialog', () => {
  it('llama onConfirm al confirmar y muestra Guardando… cuando pending', async () => {
    const onConfirm = vi.fn()
    const { rerender } = render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="¿Bloquear?"
        description="Se cerrará la sesión."
        confirmLabel="Bloquear"
        onConfirm={onConfirm}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Bloquear' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    rerender(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="¿Bloquear?"
        description="Se cerrará la sesión."
        confirmLabel="Bloquear"
        onConfirm={onConfirm}
        pending
      />,
    )
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
  })
})
