import { onlineManager, useMutation } from '@tanstack/react-query'
import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { OfflineNotice } from './offline-notice'

const AVISO = 'Sin conexión: lo que marques se enviará al volver la señal'

/** Un botón con una mutación de verdad: sin red, TanStack Query la deja en pausa. */
function MarkButton() {
  const mutation = useMutation({ mutationFn: async () => 'ok' })
  return (
    <button type="button" onClick={() => mutation.mutate()}>
      Recibido
    </button>
  )
}

describe('OfflineNotice (UX4-11)', () => {
  beforeEach(() => {
    onlineManager.setOnline(true)
  })

  afterEach(() => {
    act(() => onlineManager.setOnline(true))
  })

  it('con red no muestra ningún aviso', () => {
    renderWithProviders(<OfflineNotice />)

    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('sin red avisa con role="status" que lo marcado se enviará al volver la señal', () => {
    renderWithProviders(<OfflineNotice />)

    act(() => onlineManager.setOnline(false))

    expect(screen.getByRole('status')).toHaveTextContent(AVISO)
  })

  it('al volver la red el aviso desaparece', () => {
    renderWithProviders(<OfflineNotice />)
    act(() => onlineManager.setOnline(false))

    act(() => onlineManager.setOnline(true))

    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('sin red cuenta las acciones que esperan la señal', async () => {
    const { user } = renderWithProviders(
      <>
        <OfflineNotice />
        <MarkButton />
      </>,
    )
    act(() => onlineManager.setOnline(false))

    await user.click(screen.getByRole('button', { name: 'Recibido' }))

    expect(await screen.findByText('1 acción por enviar')).toBeInTheDocument()
    // Las dos frases no se pegan para el lector de pantalla («señal1 acción»).
    expect(screen.getByRole('status')).toHaveTextContent(`${AVISO} 1 acción por enviar`)

    await user.click(screen.getByRole('button', { name: 'Recibido' }))

    expect(await screen.findByText('2 acciones por enviar')).toBeInTheDocument()
  })

  it('sin acciones en pausa no muestra contador', () => {
    renderWithProviders(<OfflineNotice />)

    act(() => onlineManager.setOnline(false))

    expect(screen.queryByText(/por enviar/)).not.toBeInTheDocument()
  })
})
