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

  // UX3-12: todos los diálogos cierran con «Volver»; «Cancelar» se confundía con
  // «Cancelar trabajo».
  it('cierra con «Volver»', async () => {
    const onOpenChange = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Bloquear acceso"
        description="Se cerrará la sesión."
        confirmLabel="Bloquear"
        onConfirm={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
