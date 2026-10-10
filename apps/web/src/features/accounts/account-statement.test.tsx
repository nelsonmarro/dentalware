import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LabSettings } from '@/features/config/api'
import { renderWithQueryAndRouter } from '@/test/render'
import { AccountStatement } from './account-statement'
import type { AccountStatement as Statement } from './api'

const LAB = {
  id: 'lab-1',
  name: 'Arte Dental',
  ruc: '1791234567001',
  address: 'Puerto Rico N27-33 y La Isla',
  phone: '0961440991',
  logoUrl: null,
} as unknown as LabSettings

const zero = { '0_30': '0.00', '31_60': '0.00', '61_90': '0.00', '90_mas': '0.00' }

type Movement = Statement['movements'][number]
const movement = (m: Partial<Movement>) =>
  ({
    case: null,
    by: null,
    reason: null,
    reference: null,
    method: null,
    remaining: null,
    allocations: null,
    voided: null,
    ...m,
  }) as Movement

const statement = (over: Partial<Statement> = {}) =>
  ({
    clinic: {
      id: 'c1',
      name: 'Clínica Sur',
      ruc: '1790012345001',
      address: 'Av. Amazonas N34-120',
      city: 'Quito',
      phone: '022345678',
    },
    range: { desde: '2026-10-01', hasta: '2026-10-06' },
    openingDate: '2026-09-30',
    openingBalance: '140.00',
    movements: [
      movement({
        id: 'p-anulado',
        kind: 'pago',
        date: '2026-10-05',
        amount: '-5.00',
        balance: '140.00',
        method: 'efectivo',
        voided: { at: '2026-10-05T18:00:00.000Z', by: 'Admin', reason: 'Duplicado' },
      } as unknown as Movement),
      movement({
        id: 'caso-1',
        kind: 'cargo',
        date: '2026-10-06',
        amount: '45.00',
        balance: '185.00',
        case: { id: 'caso-1', code: '26-00087' },
      }),
      movement({
        id: 'p1',
        kind: 'pago',
        date: '2026-10-06',
        amount: '-20.00',
        balance: '165.00',
        method: 'transferencia',
        reference: 'TRX-1',
      }),
    ],
    totals: { cargo: '45.00', ajuste: '0.00', pago: '-20.00' },
    closingBalance: '165.00',
    credit: '10.00',
    aging: { ...zero, '0_30': '25.00', '90_mas': '140.00' },
    oldestDays: 98,
    openCases: [
      {
        id: 'caso-1',
        code: '26-00087',
        patientRef: 'Ana Ruiz',
        deliveredAt: '2026-10-06T17:00:00.000Z',
        charge: '45.00',
        adjustments: '0.00',
        allocated: '20.00',
        outstanding: '25.00',
        days: 0,
      },
    ],
    breakdown: {
      openCases: '25.00',
      unlinkedAdjustments: '150.00',
      unlinkedSince: '2026-06-30',
      credit: '10.00',
      balance: '165.00',
    },
    ...over,
  }) as unknown as Statement

function renderStatement(s = statement(), lab: LabSettings | null = LAB) {
  return renderWithQueryAndRouter(
    <AccountStatement statement={s} lab={lab} issuedOn="2026-10-09" />,
  )
}

describe('AccountStatement (estado de cuenta imprimible, CTA-5)', () => {
  it('encabezado: datos del laboratorio (CFG-1), rango, fecha de emisión y la clínica', async () => {
    renderStatement()
    expect(await screen.findByRole('heading', { level: 1, name: 'Estado de cuenta' })).toBeVisible()
    expect(screen.getByText('Arte Dental')).toBeVisible()
    expect(screen.getByText('RUC: 1791234567001')).toBeVisible()
    expect(screen.getByText('Del 01/10/2026 al 06/10/2026')).toBeVisible()
    expect(screen.getByText('Emitido el 09/10/2026')).toBeVisible()
    const clinic = screen.getByRole('region', { name: 'Clínica' })
    expect(within(clinic).getByText('Clínica Sur')).toBeVisible()
    expect(within(clinic).getByText('RUC: 1790012345001')).toBeVisible()
    expect(within(clinic).getByText('Av. Amazonas N34-120, Quito')).toBeVisible()
  })

  it('sin datos del laboratorio, el estado sale igual', async () => {
    renderStatement(statement(), null)
    expect(await screen.findByRole('heading', { level: 1, name: 'Estado de cuenta' })).toBeVisible()
    expect(screen.queryByText('Arte Dental')).not.toBeInTheDocument()
  })

  it('movimientos con saldo corrido: del saldo inicial al saldo final', async () => {
    renderStatement()
    const table = await screen.findByRole('table', { name: 'Movimientos' })
    const rows = within(table).getAllByRole('row').slice(1)
    const text = rows.map((r) => r.textContent)
    expect(text[0]).toContain('Saldo al 30/09/2026')
    expect(text[0]).toContain('$ 140.00')
    expect(text[2]).toContain('Trabajo 26-00087')
    expect(text[2]).toContain('+ $ 45.00')
    expect(text[2]).toContain('$ 185.00')
    expect(text[3]).toContain('Transferencia · TRX-1')
    expect(text[3]).toContain('− $ 20.00')
    expect(text[3]).toContain('$ 165.00')
    expect(text.at(-1)).toContain('Saldo al 06/10/2026')
    expect(text.at(-1)).toContain('$ 165.00')
  })

  // M5 (ruling de la revisión final del PR 2): el estado de cuenta se manda a la clínica; quién
  // anuló un pago y por qué son datos internos, que solo muestra la pantalla de la cuenta.
  it('un pago anulado se ve tachado con «Anulado», sin quién ni por qué, y no suma', async () => {
    renderStatement()
    const table = await screen.findByRole('table', { name: 'Movimientos' })
    const row = within(table).getByText('Anulado').closest('tr')!
    expect(row.textContent).not.toContain('Admin')
    expect(row.textContent).not.toContain('Duplicado')
    expect(within(row).getByText('− $ 5.00')).toHaveClass('line-through')
    // En móvil va bajo el monto y en pantalla ancha en su columna (UX5-14): jsdom no aplica CSS.
    expect(within(row).getAllByText('No suma')).toHaveLength(2)
    expect(row.textContent).not.toContain('$ 140.00')
  })

  it('el cuadre: saldo inicial, cargos, ajustes y pagos del rango dan el saldo final', async () => {
    renderStatement()
    const summary = await screen.findByRole('region', { name: 'Resumen del periodo' })
    const items = within(summary)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(items).toEqual([
      'Saldo al 30/09/2026$ 140.00',
      'Cargos+ $ 45.00',
      'Ajustes$ 0.00',
      'Pagos− $ 20.00',
      'Saldo al 06/10/2026$ 165.00',
    ])
  })

  it('montos en monoespaciada', async () => {
    renderStatement()
    const table = await screen.findByRole('table', { name: 'Movimientos' })
    expect(within(table).getByText('+ $ 45.00')).toHaveClass('font-mono')
    expect(within(table).getAllByText('$ 165.00')[0]).toHaveClass('font-mono')
  })

  it('un saldo negativo se lee «A favor», con texto', async () => {
    renderStatement(statement({ closingBalance: '-12.34' } as Partial<Statement>))
    const summary = await screen.findByRole('region', { name: 'Resumen del periodo' })
    expect(within(summary).getAllByRole('listitem').at(-1)?.textContent).toBe(
      'Saldo al 06/10/2026A favor $ 12.34',
    )
  })

  it('antigüedad a la fecha hasta, con los cuatro cubos y lo más antiguo', async () => {
    renderStatement()
    const aging = await screen.findByRole('region', { name: 'Antigüedad al 06/10/2026' })
    expect(within(aging).getByText('0–30 días').nextSibling?.textContent).toBe('$ 25.00')
    expect(within(aging).getByText('Más de 90 días').nextSibling?.textContent).toBe('$ 140.00')
    expect(within(aging).getByText('31–60 días').nextSibling?.textContent).toBe('—')
    expect(within(aging).getByText('Más antiguo: 98 días')).toBeVisible()
    expect(
      within(aging).getByText(
        (_, el) => el?.tagName === 'P' && el.textContent === 'Saldo a favor $ 10.00',
      ),
    ).toBeVisible()
  })

  it('«Por cobrar» con los días desde la entrega y lo pendiente', async () => {
    renderStatement()
    const table = await screen.findByRole('table', { name: 'Por cobrar al 06/10/2026' })
    const [, row] = within(table).getAllByRole('row')
    expect(row?.textContent).toContain('26-00087')
    expect(row?.textContent).toContain('Ana Ruiz')
    expect(row?.textContent).toContain('0 días')
    expect(within(row!).getByText('$ 25.00')).toHaveClass('font-mono')
  })

  it('«Por cobrar» cierra con el desglose del saldo final (UX5-02)', async () => {
    renderStatement()
    const section = await screen.findByRole('region', { name: 'Por cobrar al 06/10/2026' })
    const desglose = within(section).getByLabelText('Desglose del saldo')
    expect(desglose).toHaveTextContent('Trabajos$ 25.00')
    expect(desglose).toHaveTextContent(
      'Saldo inicial y ajustes sin trabajo(desde el 30/06/2026)$ 150.00',
    )
    expect(desglose).toHaveTextContent('Saldo a favor− $ 10.00')
    expect(desglose).toHaveTextContent('Saldo$ 165.00')
  })

  it('sin trabajos por cobrar, el desglose sigue diciendo el saldo inicial', async () => {
    renderStatement(
      statement({
        openCases: [],
        breakdown: {
          openCases: '0.00',
          unlinkedAdjustments: '150.00',
          unlinkedSince: '2026-06-30',
          credit: '0.00',
          balance: '150.00',
        },
      } as Partial<Statement>),
    )
    const section = await screen.findByRole('region', { name: 'Por cobrar al 06/10/2026' })
    expect(section).toHaveTextContent('Nada por cobrar al 06/10/2026.')
    expect(within(section).getByLabelText('Desglose del saldo')).toHaveTextContent('Saldo$ 150.00')
  })

  it('sin movimientos ni nada por cobrar, lo dice', async () => {
    renderStatement(statement({ movements: [], openCases: [] } as Partial<Statement>))
    expect(await screen.findByText('Sin movimientos en este periodo.')).toBeVisible()
    expect(screen.getByText('Nada por cobrar al 06/10/2026.')).toBeVisible()
  })
})
