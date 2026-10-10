import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithQueryAndRouter } from '@/test/render'
import type { ClinicAccount } from './api'
import { MovementsTable } from './movements-table'

type Movement = ClinicAccount['movements'][number]
const movement = (m: Partial<Movement> & Pick<Movement, 'id' | 'kind'>) =>
  ({
    date: '2026-10-05',
    amount: '-250.50',
    case: null,
    by: 'Rosa',
    reason: null,
    reference: null,
    method: 'transferencia',
    remaining: '0.00',
    allocations: null,
    voided: null,
    ...m,
  }) as Movement

const C1 = '11111111-1111-4111-8111-111111111111'
const C2 = '22222222-2222-4222-8222-222222222222'
const C3 = '33333333-3333-4333-8333-333333333333'

/** El pago de $ 250.50 repartido en tres trabajos (UX5-03). */
const REPARTIDO = movement({
  id: 'p1',
  kind: 'pago',
  reference: 'TRX-9',
  allocations: [
    { caseId: C1, code: '26-00101', amount: '120.00', reopens: true },
    { caseId: C2, code: '26-00102', amount: '85.50', reopens: true },
    { caseId: C3, code: '26-00107', amount: '45.00', reopens: false },
  ],
})

const ACTIONS = {
  canApply: true,
  canVoid: true,
  disabled: false,
  onApply: vi.fn(),
  onVoid: vi.fn(),
}

function renderTable(rows: Movement[]) {
  return renderWithQueryAndRouter(<MovementsTable rows={rows} actions={ACTIONS} />)
}

describe('MovementsTable: a qué trabajos se aplicó un pago (UX5-03)', () => {
  beforeEach(() => setMatchMedia(true))

  it('la fila del pago dice «Aplicado a» con cada trabajo y su monto, en orden', async () => {
    renderTable([REPARTIDO])
    const row = await screen.findByRole('row', { name: /TRX-9/ })
    expect(row).toHaveTextContent(
      'Aplicado a 26-00101 ($ 120.00), 26-00102 ($ 85.50) y 26-00107 ($ 45.00)',
    )
    // La celda de la tabla es `nowrap`: la lista se parte para no ensanchar la tabla.
    expect(within(row).getByText(/^Aplicado a/)).toHaveClass('whitespace-normal')
  })

  it('cada código enlaza a la ficha del trabajo, en monoespaciada, y el monto también', async () => {
    renderTable([REPARTIDO])
    const row = await screen.findByRole('row', { name: /TRX-9/ })
    for (const [code, id] of [
      ['26-00101', C1],
      ['26-00102', C2],
      ['26-00107', C3],
    ] as const) {
      const link = within(row).getByRole('link', { name: code })
      expect(link).toHaveAttribute('href', `/trabajos/${id}`)
      expect(link).toHaveClass('font-mono')
    }
    expect(within(row).getByText('$ 85.50')).toHaveClass('font-mono')
  })

  it('con un solo trabajo, sin «y»', async () => {
    renderTable([
      movement({
        id: 'p2',
        kind: 'pago',
        reference: 'TRX-1',
        allocations: [{ caseId: C1, code: '26-00101', amount: '120.00', reopens: true }],
      }),
    ])
    const row = await screen.findByRole('row', { name: /TRX-1/ })
    expect(row).toHaveTextContent('Aplicado a 26-00101 ($ 120.00)')
  })

  it('sin asignaciones vigentes (anticipo o anulado), no dice nada', async () => {
    renderTable([
      movement({ id: 'p3', kind: 'pago', reference: 'ANTICIPO', allocations: [] }),
      movement({
        id: 'p4',
        kind: 'pago',
        reference: 'ANULADO',
        allocations: [],
        voided: { at: '2026-10-06T15:00:00.000Z', by: 'Ana', reason: 'Duplicado' },
      } as unknown as Movement),
    ])
    await screen.findByRole('row', { name: /ANTICIPO/ })
    expect(screen.queryByText(/Aplicado a/)).not.toBeInTheDocument()
  })

  it('en móvil, la tarjeta lo dice igual y los enlaces miden 44 px (36 solo con ratón en escritorio)', async () => {
    setMatchMedia(false)
    renderTable([REPARTIDO])
    const link = await screen.findByRole('link', { name: '26-00102' })
    expect(link.closest('p')).toHaveTextContent(
      'Aplicado a 26-00101 ($ 120.00), 26-00102 ($ 85.50) y 26-00107 ($ 45.00)',
    )
    expect(link).toHaveClass('min-h-11', 'lg:pointer-fine:min-h-9')
    // No es un identificador de fila: entra en el barrido táctil.
    expect(link).not.toHaveAttribute('data-target-size')
  })
})

describe('MovementsTable: columna de acciones (UX5-12)', () => {
  beforeEach(() => setMatchMedia(true))

  const CARGO = movement({
    id: 'k1',
    kind: 'cargo',
    amount: '120.00',
    method: null,
    case: { id: C1, code: '26-00101' },
  } as unknown as Movement)
  const SIN_SALDO = movement({ id: 'p5', kind: 'pago', reference: 'TRX-5', allocations: [] })

  it('sin ninguna acción posible no reserva la columna «Acciones»', async () => {
    // Recepción (no anula) y un pago sin nada a favor: ninguna fila tiene acciones.
    renderWithQueryAndRouter(
      <MovementsTable rows={[CARGO, SIN_SALDO]} actions={{ ...ACTIONS, canVoid: false }} />,
    )
    await screen.findByRole('row', { name: /TRX-5/ })
    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()
  })

  it('con alguna acción, la columna está', async () => {
    renderWithQueryAndRouter(
      <MovementsTable
        rows={[CARGO, { ...SIN_SALDO, remaining: '10.00' }]}
        actions={{ ...ACTIONS, canVoid: false }}
      />,
    )
    expect(await screen.findByRole('columnheader', { name: 'Acciones' })).toBeInTheDocument()
  })
})

describe('MovementsTable: «Anular pago» aparte (UX5-18)', () => {
  const CON_SALDO = movement({ id: 'p6', kind: 'pago', reference: 'TRX-6', remaining: '10.00' })

  it('en escritorio va después de «Aplicar saldo a favor», separado por una raya', async () => {
    setMatchMedia(true)
    renderTable([CON_SALDO])
    const apply = await screen.findByRole('button', { name: /^Aplicar saldo a favor/ })
    const anular = screen.getByRole('button', { name: /^Anular pago/ })
    expect(apply.compareDocumentPosition(anular) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(anular.parentElement).not.toBe(apply.parentElement)
    expect(anular.parentElement).toHaveClass('border-l')
  })

  it('en móvil «Aplicar saldo a favor» va a lo ancho y «Anular pago» debajo, tras una raya', async () => {
    setMatchMedia(false)
    renderTable([CON_SALDO])
    const apply = await screen.findByRole('button', { name: /^Aplicar saldo a favor/ })
    const anular = screen.getByRole('button', { name: /^Anular pago/ })
    expect(apply).toHaveClass('w-full')
    expect(apply.compareDocumentPosition(anular) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(anular.parentElement).not.toBe(apply.parentElement)
    expect(anular.parentElement).toHaveClass('border-t')
  })
})

describe('MovementsTable: textos largos sin ensanchar ni partir el código', () => {
  const AJUSTE = movement({
    id: 'a1',
    kind: 'ajuste',
    amount: '-15.00',
    method: null,
    reason: 'Descuento acordado con la doctora por la demora en la entrega de la prótesis',
    case: { id: C1, code: '26-00105' },
  } as unknown as Movement)

  it('en escritorio el motivo largo se parte dentro de la celda (la celda es `nowrap`)', async () => {
    setMatchMedia(true)
    renderTable([AJUSTE])
    const text = await screen.findByText(/Descuento acordado/)
    expect(text.closest('td')).toHaveClass('whitespace-normal')
  })

  it('el código del trabajo no se parte en «26-» / «00105»', async () => {
    setMatchMedia(false)
    renderTable([AJUSTE])
    expect(await screen.findByRole('link', { name: '26-00105' })).toHaveClass('whitespace-nowrap')
  })
})
