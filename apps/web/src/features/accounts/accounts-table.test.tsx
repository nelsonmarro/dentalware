import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import { AccountsTable } from './accounts-table'
import type { AccountRow } from './api'

const zero = { '0_30': '0.00', '31_60': '0.00', '61_90': '0.00', '90_mas': '0.00' }

// En el orden en que llegan de la API: de mayor a menor saldo.
const ROWS: AccountRow[] = [
  {
    id: 'c1',
    name: 'Clínica Sur',
    balance: '1250.00',
    credit: '0.00',
    aging: { ...zero, '0_30': '200.00', '90_mas': '1050.00' },
    oldestDays: 95,
    openCasesCount: 3,
    openCasesTotal: '1250.00',
  },
  {
    id: 'c2',
    name: 'Dental Norte',
    balance: '300.00',
    credit: '0.00',
    aging: { ...zero, '31_60': '300.00' },
    oldestDays: 1,
    openCasesCount: 1,
    openCasesTotal: '300.00',
  },
  {
    id: 'c3',
    name: 'Odonto Centro',
    balance: '-12.34',
    credit: '12.34',
    aging: zero,
    oldestDays: null,
    openCasesCount: 0,
    openCasesTotal: '0.00',
  },
]

const rowOf = (name: string) => screen.getByRole('link', { name }).closest('tr')!

describe('AccountsTable — escritorio', () => {
  it('una fila por clínica con saldo, los cuatro cubos de antigüedad y lo más antiguo', async () => {
    setMatchMedia(true)
    renderWithRouter(<AccountsTable rows={ROWS} todas={false} />)
    await screen.findByRole('table')

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual([
      expect.stringContaining('Clínica'),
      expect.stringContaining('Saldo'),
      '0–30 días',
      '31–60 días',
      '61–90 días',
      'Más de 90 días',
      expect.stringContaining('Más antiguo'),
    ])
    const cells = within(rowOf('Clínica Sur'))
      .getAllByRole('cell')
      .map((c) => c.textContent)
    expect(cells).toEqual([
      'Clínica Sur',
      '$ 1250.00',
      '$ 200.00',
      '—',
      '—',
      '$ 1050.00',
      '95 días',
    ])
    expect(within(rowOf('Dental Norte')).getByText('1 día')).toBeInTheDocument()
  })

  it('la clínica lleva a su cuenta', async () => {
    setMatchMedia(true)
    renderWithRouter(<AccountsTable rows={ROWS} todas={false} />)
    expect(await screen.findByRole('link', { name: 'Clínica Sur' })).toHaveAttribute(
      'href',
      '/cuentas/c1',
    )
  })

  it('un saldo negativo se dice «A favor», con texto, y sin días vencidos', async () => {
    setMatchMedia(true)
    renderWithRouter(<AccountsTable rows={ROWS} todas={false} />)
    await screen.findByRole('table')
    const cells = within(rowOf('Odonto Centro')).getAllByRole('cell')
    expect(cells[1]).toHaveTextContent('A favor $ 12.34')
    expect(cells[6]).toHaveTextContent('—')
  })

  it('los montos van en monoespaciada y alineados a la derecha', async () => {
    setMatchMedia(true)
    renderWithRouter(<AccountsTable rows={ROWS} todas={false} />)
    await screen.findByRole('table')
    const saldo = within(rowOf('Clínica Sur')).getAllByRole('cell')[1]!
    expect(saldo).toHaveClass('text-right')
    expect(within(saldo).getByText('$ 1250.00')).toHaveClass('font-mono')
    expect(screen.getByRole('columnheader', { name: /Saldo/ })).toHaveClass('text-right')
  })

  it('conserva el orden de la API (de mayor a menor saldo)', async () => {
    setMatchMedia(true)
    renderWithRouter(<AccountsTable rows={ROWS} todas={false} />)
    await screen.findByRole('table')
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Clínica Sur',
      'Dental Norte',
      'Odonto Centro',
    ])
  })

  it('ordena por saldo como número, no como texto', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    // Dos saldos a favor: como texto «-12.34» iría antes que «-100.00».
    const rows = [
      ...ROWS,
      {
        id: 'c4',
        name: 'Labo Este',
        balance: '-100.00',
        credit: '100.00',
        aging: zero,
        oldestDays: null,
        openCasesCount: 0,
        openCasesTotal: '0.00',
      },
    ]
    renderWithRouter(<AccountsTable rows={rows} todas={false} />)
    await user.click(await screen.findByRole('button', { name: 'Ordenar por Saldo' }))
    const names = () => screen.getAllByRole('link').map((l) => l.textContent)
    const first = names()
    await user.click(screen.getByRole('button', { name: 'Ordenar por Saldo' }))
    const second = names()
    const asc = ['Labo Este', 'Odonto Centro', 'Dental Norte', 'Clínica Sur']
    expect([first, second]).toContainEqual(asc)
    expect([first, second]).toContainEqual([...asc].reverse())
  })

  it('un nombre largo se parte en la columna de la clínica en vez de ensanchar la tabla (UX5-05)', async () => {
    setMatchMedia(true)
    renderWithRouter(<AccountsTable rows={ROWS} todas={false} />)
    const cell = (await screen.findByRole('link', { name: 'Clínica Sur' })).closest('td')!
    // La celda de la tabla es `nowrap`: sin esto, «Centro Odontológico Integral … Valle de los
    // Chillos» ocupaba una sola línea y la tabla se desplazaba a 1280.
    expect(cell).toHaveClass('whitespace-normal')
    expect(screen.getByRole('columnheader', { name: 'Clínica' })).toHaveClass('min-w-48')
  })

  it('busca por clínica', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<AccountsTable rows={ROWS} todas={false} />)
    await user.type(await screen.findByLabelText('Buscar clínica'), 'norte')
    expect(screen.getByRole('link', { name: 'Dental Norte' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Clínica Sur' })).not.toBeInTheDocument()
  })

  it('sin coincidencias, lo dice con la búsqueda', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<AccountsTable rows={ROWS} todas={false} />)
    await user.type(await screen.findByLabelText('Buscar clínica'), 'xyz')
    expect(await screen.findByText('Ninguna clínica coincide con "xyz".')).toBeInTheDocument()
  })

  it('vacía, invita a ver todas las clínicas', async () => {
    setMatchMedia(true)
    renderWithRouter(<AccountsTable rows={[]} todas={false} />)
    expect(
      await screen.findByText(
        'Ninguna clínica debe ni tiene movimientos. Activa «Ver todas las clínicas» para ver el resto.',
      ),
    ).toBeInTheDocument()
  })

  it('vacía con todas las clínicas, no hay ninguna activa', async () => {
    setMatchMedia(true)
    renderWithRouter(<AccountsTable rows={[]} todas />)
    expect(await screen.findByText('Aún no hay clínicas activas.')).toBeInTheDocument()
  })
})

describe('AccountsTable — móvil', () => {
  it('cada clínica es una tarjeta que lleva a su cuenta, con saldo, antigüedad y lo más antiguo', async () => {
    setMatchMedia(false)
    renderWithRouter(<AccountsTable rows={ROWS} todas={false} />)
    const card = await screen.findByRole('link', { name: /Clínica Sur/ })
    expect(card).toHaveAttribute('href', '/cuentas/c1')
    expect(card).toHaveTextContent('$ 1250.00')
    expect(card).toHaveTextContent('Más antiguo: 95 días')
    expect(card).toHaveTextContent('0–30 días$ 200.00')
    expect(card).toHaveTextContent('Más de 90 días$ 1050.00')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('la pestaña de la tarjeta sigue al cubo de lo más antiguo', async () => {
    setMatchMedia(false)
    renderWithRouter(<AccountsTable rows={ROWS} todas={false} />)
    expect(await screen.findByRole('link', { name: /Clínica Sur/ })).toHaveAttribute(
      'data-aging',
      '90_mas',
    )
    expect(screen.getByRole('link', { name: /Dental Norte/ })).toHaveAttribute('data-aging', '0_30')
    expect(screen.getByRole('link', { name: /Odonto Centro/ })).toHaveAttribute(
      'data-aging',
      'al_dia',
    )
  })

  it('saldo a favor en la tarjeta, sin días vencidos', async () => {
    setMatchMedia(false)
    renderWithRouter(<AccountsTable rows={ROWS} todas={false} />)
    const card = await screen.findByRole('link', { name: /Odonto Centro/ })
    expect(card).toHaveTextContent('A favor $ 12.34')
    expect(card).toHaveTextContent('Nada pendiente')
  })

  // Final review M-3: la tarjeta decía «A favor $ 125.00 · Nada pendiente» y, al entrar, la
  // cabecera «1 trabajo por cobrar ($ 75.00), cubierto por el saldo a favor» (UX5-01).
  it('con trabajos por cobrar que cubre el saldo a favor, lo dice como la cabecera de la cuenta', async () => {
    setMatchMedia(false)
    const sur: AccountRow = {
      id: 'c5',
      name: 'Clínica Sur UX',
      balance: '-125.00',
      credit: '200.00',
      aging: zero,
      oldestDays: null,
      openCasesCount: 1,
      openCasesTotal: '75.00',
    }
    renderWithRouter(<AccountsTable rows={[sur]} todas={false} />)
    const card = await screen.findByRole('link', { name: /Clínica Sur UX/ })
    expect(card).toHaveTextContent('A favor $ 125.00')
    expect(card).toHaveTextContent('1 trabajo por cobrar ($ 75.00), cubierto por el saldo a favor')
    expect(card).not.toHaveTextContent('Nada pendiente')
  })

  it('un solo «Ordenar» con cada orden escrito en palabras (UX5-09)', async () => {
    setMatchMedia(false)
    const user = userEvent.setup()
    renderWithRouter(<AccountsTable rows={ROWS} todas={false} />)
    const select = await screen.findByRole('combobox', { name: 'Ordenar' })
    expect(screen.queryByLabelText('Dirección')).not.toBeInTheDocument()
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      'Sin orden',
      'Clínica A–Z',
      'Clínica Z–A',
      'Saldo: de menor a mayor',
      'Saldo: de mayor a menor',
      'Más reciente primero',
      'Más antiguo primero',
    ])
    await user.selectOptions(select, 'Más reciente primero')
    const cards = screen.getAllByRole('link').map((l) => l.getAttribute('href'))
    expect(cards).toEqual(['/cuentas/c3', '/cuentas/c2', '/cuentas/c1'])
  })
})
