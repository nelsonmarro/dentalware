import { screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { CourierSelect } from './courier-select'

const { fetchCouriers } = vi.hoisted(() => ({ fetchCouriers: vi.fn() }))
vi.mock('./api', () => ({ fetchCouriers }))

beforeEach(() => {
  fetchCouriers.mockReset()
  fetchCouriers.mockResolvedValue([
    { id: 'm1', name: 'Bruno Mensajero' },
    { id: 'm2', name: 'Zoila Mensajera' },
  ])
})

function Harness({ initial = '', selectedName }: { initial?: string; selectedName?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <CourierSelect id="mensajero" value={value} onChange={setValue} selectedName={selectedName} />
      <output aria-label="valor">{value}</output>
    </>
  )
}

describe('CourierSelect', () => {
  it('ofrece los mensajeros activos y al elegir uno entrega su id', async () => {
    const { user } = renderWithProviders(<Harness />)
    const select = screen.getByRole('combobox', { name: 'Mensajero' })
    expect(select).toHaveTextContent('Elegir mensajero')
    await waitFor(() => expect(fetchCouriers).toHaveBeenCalled())
    await user.click(select)
    await user.click(await screen.findByRole('option', { name: 'Zoila Mensajera' }))
    expect(screen.getByLabelText('valor')).toHaveTextContent('m2')
    expect(screen.getByRole('combobox', { name: 'Mensajero' })).toHaveTextContent('Zoila Mensajera')
  })

  // Lección de la Tarea 4 de la ola (TechnicianSelect): con un valor ya elegido, mientras la
  // lista carga se ve su nombre, nunca el marcador de «sin elegir».
  it('mientras la lista carga muestra el nombre del mensajero ya elegido', () => {
    fetchCouriers.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<Harness initial="m9" selectedName="Pedro Mensajero" />)
    const select = screen.getByRole('combobox', { name: 'Mensajero' })
    expect(select).toHaveTextContent('Pedro Mensajero')
    expect(select).not.toHaveTextContent('Elegir mensajero')
  })

  it('si la lista no carga lo dice y deja reintentar', async () => {
    fetchCouriers.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const { user } = renderWithProviders(<Harness />)
    expect(await screen.findByText('No se pudieron cargar los mensajeros.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(fetchCouriers).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.queryByText('No se pudieron cargar los mensajeros.')).not.toBeInTheDocument(),
    )
  })
})
