import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { FormDialog } from './form-dialog'

/** Una página con su `h1` y un disparador que, si `removesTrigger`, desaparece al cerrar (como
 * la tarjeta de «Entregas» que deja de tener acción tras marcar entregado). */
function Page({ removesTrigger }: { removesTrigger: boolean }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  return (
    <main>
      <h1>Entregas</h1>
      {!done && <button onClick={() => setOpen(true)}>Marcar entregado</button>}
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Marcar entregado"
        footer={
          <button
            onClick={() => {
              if (removesTrigger) setDone(true)
              setOpen(false)
            }}
          >
            Confirmar
          </button>
        }
      >
        <p>Contenido</p>
      </FormDialog>
    </main>
  )
}

describe('FormDialog', () => {
  it('nombra sobre qué actúa al abrir la descripción', () => {
    render(
      <FormDialog
        open
        onOpenChange={() => {}}
        title="No se pudo entregar"
        context="26-00087 · Clínica Sur"
        description="La entrega queda como fallida."
        footer={null}
      >
        <p>Contenido</p>
      </FormDialog>,
    )
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      '26-00087 · Clínica Sur La entrega queda como fallida.',
    )
  })

  it('al cerrar, el foco vuelve al disparador', async () => {
    const user = userEvent.setup()
    render(<Page removesTrigger={false} />)
    await user.click(screen.getByRole('button', { name: 'Marcar entregado' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Marcar entregado' })).toHaveFocus()
  })

  // Minor de la Tarea 3: si el disparador ya no está (la acción lo quitó), el foco no se pierde
  // en el `body`: va al `h1` de la página.
  it('si el disparador desapareció, el foco va al h1 de la página', async () => {
    const user = userEvent.setup()
    render(<Page removesTrigger />)
    await user.click(screen.getByRole('button', { name: 'Marcar entregado' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus())
  })
})
