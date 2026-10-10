import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('FormDialog', () => {
  it('nombra sobre qué actúa al abrir la descripción', () => {
    render(
      <FormDialog
        open
        onOpenChange={() => {}}
        title="No se pudo entregar"
        context={{ code: '26-00087', label: 'Clínica Sur' }}
        description="La entrega queda como fallida."
        footer={null}
      >
        <p>Contenido</p>
      </FormDialog>,
    )
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      '26-00087 · Clínica Sur La entrega queda como fallida.',
    )
    // M-7 de la revisión de la Tarea 9: la monoespaciada, solo para el código.
    expect(screen.getByText('26-00087')).toHaveClass('font-mono')
    expect(screen.getByText('26-00087').parentElement).not.toHaveClass('font-mono')
  })

  // Iteración 5: «Registrar pago» actúa sobre una clínica, sin código que mostrar.
  it('el contexto puede ser solo un nombre, sin código', () => {
    render(
      <FormDialog
        open
        onOpenChange={() => {}}
        title="Registrar pago"
        context={{ label: 'Clínica Sur' }}
        description="Lo que no se reparta queda a favor."
        footer={null}
      >
        <p>Contenido</p>
      </FormDialog>,
    )
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'Clínica Sur Lo que no se reparta queda a favor.',
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

  // Safari en el iPhone no enfoca un botón al tocarlo: el foco estaba en el `body` al abrir, y
  // devolverlo allí es perderlo.
  it('si nada tenía el foco al abrir, al cerrar va al h1 de la página', async () => {
    function Abierto() {
      const [open, setOpen] = useState(true)
      return (
        <main>
          <h1>Entregas</h1>
          <FormDialog
            open={open}
            onOpenChange={setOpen}
            title="Marcar entregado"
            footer={<button onClick={() => setOpen(false)}>Volver</button>}
          >
            <p>Contenido</p>
          </FormDialog>
        </main>
      )
    }
    const user = userEvent.setup()
    render(<Abierto />)
    await user.click(await screen.findByRole('button', { name: 'Volver' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus())
  })

  // I-1 de la revisión de la Tarea 9: devolver el foco no desplaza la página (con la lista de
  // «Entregas» desplazada, el mensajero no pierde su sitio), igual que enfoca Radix.
  it('devuelve el foco sin desplazar la página', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    const user = userEvent.setup()
    render(<Page removesTrigger />)
    await user.click(screen.getByRole('button', { name: 'Marcar entregado' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus())
    const h1 = screen.getByRole('heading', { level: 1 })
    const calls = focus.mock.contexts
      .map((ctx, i) => [ctx, focus.mock.calls[i]?.[0]] as const)
      .filter(([ctx]) => ctx === h1)
    expect(calls.map(([, opts]) => opts)).toEqual([{ preventScroll: true }])
  })

  // UX5-06: con mucho contenido (el reparto de cinco trabajos), solo el cuerpo se desplaza; el
  // pie con el botón principal, «Volver» y el resumen en vivo queda siempre a la vista.
  describe('pie fijo', () => {
    function renderLong(summary?: ReactNode) {
      render(
        <FormDialog
          open
          onOpenChange={() => {}}
          title="Registrar pago"
          summary={summary}
          footer={
            <>
              <button>Volver</button>
              <button>Registrar pago</button>
            </>
          }
        >
          <p>Contenido largo</p>
        </FormDialog>,
      )
      const dialog = screen.getByRole('dialog')
      const body = screen.getByText('Contenido largo').parentElement as HTMLElement
      return { dialog, body }
    }

    it('el cuerpo se desplaza y el diálogo no', () => {
      const { dialog, body } = renderLong()
      expect(body).toHaveClass('overflow-y-auto', 'min-h-0')
      expect(dialog).not.toHaveClass('overflow-y-auto')
      expect(dialog).toHaveClass('flex', 'flex-col')
    })

    it('los botones del pie quedan fuera del cuerpo que se desplaza', () => {
      const { dialog, body } = renderLong()
      const main = screen.getByRole('button', { name: 'Registrar pago' })
      const back = screen.getByRole('button', { name: 'Volver' })
      expect(body).not.toContainElement(main)
      expect(body).not.toContainElement(back)
      expect(dialog).toContainElement(main)
    })

    it('el resumen va en el pie, encima de los botones y fuera del cuerpo', () => {
      const { body } = renderLong(<p role="status">Aplicado $ 80.00 · Queda a favor $ 20.00</p>)
      const status = screen.getByRole('status')
      const main = screen.getByRole('button', { name: 'Registrar pago' })
      expect(body).not.toContainElement(status)
      const footer = status.closest('[data-slot="form-dialog-footer"]')
      expect(footer).not.toBeNull()
      expect(footer).toContainElement(main)
      expect(status.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })
})
