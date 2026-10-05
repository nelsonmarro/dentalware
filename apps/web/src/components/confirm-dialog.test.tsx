import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

  // M-9 de la revisión de la Tarea 9: como `FormDialog`, al cerrar el foco vuelve a quien lo
  // abrió o, si la acción lo quitó (p. ej. «Finalizar»), al `h1`; nunca se pierde en el `body`
  // ni desplaza la página.
  describe('foco al cerrar', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    function Page({ removesTrigger }: { removesTrigger: boolean }) {
      const [open, setOpen] = useState(false)
      const [done, setDone] = useState(false)
      return (
        <main>
          <h1>Trabajo</h1>
          {!done && <button onClick={() => setOpen(true)}>Finalizar</button>}
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title="Finalizar"
            description="El trabajo pasará a terminado."
            confirmLabel="Sí, finalizar"
            onConfirm={() => {
              if (removesTrigger) setDone(true)
              setOpen(false)
            }}
          />
        </main>
      )
    }

    it('vuelve al disparador, sin desplazar la página', async () => {
      const focus = vi.spyOn(HTMLElement.prototype, 'focus')
      const user = userEvent.setup()
      render(<Page removesTrigger={false} />)
      const trigger = screen.getByRole('button', { name: 'Finalizar' })
      await user.click(trigger)
      await user.click(await screen.findByRole('button', { name: 'Volver' }))
      await waitFor(() => expect(trigger).toHaveFocus())
      const lastOnTrigger = focus.mock.contexts.lastIndexOf(trigger)
      expect(focus.mock.calls[lastOnTrigger]?.[0]).toEqual({ preventScroll: true })
    })

    it('si el disparador desapareció, va al h1', async () => {
      const user = userEvent.setup()
      render(<Page removesTrigger />)
      await user.click(screen.getByRole('button', { name: 'Finalizar' }))
      await user.click(await screen.findByRole('button', { name: 'Sí, finalizar' }))
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus())
    })
  })
})
