import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithQueryAndRouter } from '@/test/render'
import { AccountsList } from './accounts-list'
import { type AccountRow, fetchAccounts } from './api'

vi.mock('./api', () => ({ fetchAccounts: vi.fn() }))

const zero = { '0_30': '0.00', '31_60': '0.00', '61_90': '0.00', '90_mas': '0.00' }
const ROW: AccountRow = {
  id: 'c1',
  name: 'Clínica Sur',
  balance: '80.00',
  aging: { ...zero, '0_30': '80.00' },
  oldestDays: 3,
}

describe('AccountsList', () => {
  beforeEach(() => {
    setMatchMedia(true)
    vi.mocked(fetchAccounts).mockReset()
  })

  it('pide solo las clínicas con saldo o movimientos y las muestra', async () => {
    vi.mocked(fetchAccounts).mockResolvedValue([ROW])
    renderWithQueryAndRouter(<AccountsList todas={false} onTodasChange={vi.fn()} />)
    expect(await screen.findByRole('link', { name: 'Clínica Sur' })).toBeInTheDocument()
    expect(fetchAccounts).toHaveBeenCalledWith({ todas: false })
    expect(screen.getByRole('switch', { name: 'Ver todas las clínicas' })).not.toBeChecked()
  })

  it('con «Ver todas las clínicas» activo, las pide todas', async () => {
    vi.mocked(fetchAccounts).mockResolvedValue([ROW])
    renderWithQueryAndRouter(<AccountsList todas onTodasChange={vi.fn()} />)
    await screen.findByRole('link', { name: 'Clínica Sur' })
    expect(fetchAccounts).toHaveBeenCalledWith({ todas: true })
    expect(screen.getByRole('switch', { name: 'Ver todas las clínicas' })).toBeChecked()
  })

  it('el interruptor avisa del cambio', async () => {
    vi.mocked(fetchAccounts).mockResolvedValue([ROW])
    const onTodasChange = vi.fn()
    const { user } = renderWithQueryAndRouter(
      <AccountsList todas={false} onTodasChange={onTodasChange} />,
    )
    await user.click(await screen.findByRole('switch', { name: 'Ver todas las clínicas' }))
    expect(onTodasChange).toHaveBeenCalledWith(true)
  })

  it('un fallo de red ofrece reintentar, en vez de una lista vacía', async () => {
    vi.mocked(fetchAccounts).mockRejectedValue(new TypeError('Failed to fetch'))
    const { user } = renderWithQueryAndRouter(
      <AccountsList todas={false} onTodasChange={vi.fn()} />,
    )
    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la información')
    // Embebido junto al interruptor: no le roba el foco.
    expect(retry).not.toHaveFocus()
    expect(screen.queryByText(/Ninguna clínica debe ni tiene movimientos/)).not.toBeInTheDocument()

    vi.mocked(fetchAccounts).mockResolvedValue([ROW])
    await user.click(retry)
    expect(await screen.findByRole('link', { name: 'Clínica Sur' })).toBeInTheDocument()
  })

  it('sin clínicas que mostrar, invita a ver todas', async () => {
    vi.mocked(fetchAccounts).mockResolvedValue([])
    renderWithQueryAndRouter(<AccountsList todas={false} onTodasChange={vi.fn()} />)
    expect(await screen.findByText(/Ninguna clínica debe ni tiene movimientos/)).toBeInTheDocument()
  })
})
