import { act, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { mutationKeys } from '@/lib/query-keys'
import { setMatchMedia } from '@/test/match-media'
import { renderWithQueryAndRouter } from '@/test/render'
import { type ClinicAccount, fetchClinicAccount } from './api'
import { ClinicAccountContent } from './clinic-account-content'

vi.mock('./api', () => ({ fetchClinicAccount: vi.fn() }))

const zero = { '0_30': '0.00', '31_60': '0.00', '61_90': '0.00', '90_mas': '0.00' }
const account = (balance: string, extra: Partial<ClinicAccount> = {}) =>
  ({
    clinic: { id: 'c1', name: 'Clínica Sur' },
    balance,
    credit: '0.00',
    aging: zero,
    oldestDays: null,
    openCases: [],
    breakdown: {
      openCases: '0.00',
      unlinkedAdjustments: '0.00',
      unlinkedSince: null,
      credit: '0.00',
      balance,
    },
    billedCases: [],
    movements: [],
    ...extra,
  }) as unknown as ClinicAccount

type Movement = ClinicAccount['movements'][number]
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

const T1 = '22222222-2222-4222-8222-222222222222'

/** Una cuenta con de todo: un trabajo por cobrar, su cargo, un ajuste, un pago con saldo a
 * favor, uno asignado entero y uno anulado. */
const FULL = account('70.00', {
  credit: '20.00',
  aging: { ...zero, '31_60': '70.00' },
  oldestDays: 37,
  openCases: [
    {
      id: T1,
      code: '26-00001',
      patientRef: 'Ana Ruiz',
      deliveredAt: '2026-09-01T15:00:00.000Z',
      charge: '90.00',
      adjustments: '0.00',
      allocated: '0.00',
      outstanding: '90.00',
      days: 37,
    },
  ] as unknown as ClinicAccount['openCases'],
  breakdown: {
    openCases: '90.00',
    unlinkedAdjustments: '10.00',
    unlinkedSince: '2026-09-02',
    credit: '20.00',
    balance: '70.00',
  },
  movements: [
    movement({
      id: 'p-anulado',
      kind: 'pago',
      date: '2026-10-07',
      amount: '-30.00',
      method: 'efectivo',
      by: 'Rosa',
      remaining: '0.00',
      allocations: [],
      voided: { at: '2026-10-07T20:00:00.000Z', by: 'Ana Admin', reason: 'Registrado dos veces' },
    } as unknown as Partial<Movement>),
    movement({
      id: 'p-favor',
      kind: 'pago',
      date: '2026-10-06',
      amount: '-20.00',
      method: 'transferencia',
      reference: 'TRX-1',
      by: 'Rosa',
      remaining: '20.00',
      allocations: [],
    }),
    movement({
      id: 'p-entero',
      kind: 'pago',
      date: '2026-10-05',
      amount: '-10.00',
      method: 'efectivo',
      by: 'Rosa',
      remaining: '0.00',
      allocations: [{ caseId: T1, code: '26-00001', amount: '10.00', reopens: false }],
    }),
    movement({
      id: 'a1',
      kind: 'ajuste',
      date: '2026-09-02',
      amount: '10.00',
      reason: 'Saldo inicial',
      by: 'Ana Admin',
    }),
    movement({
      id: T1,
      kind: 'cargo',
      date: '2026-09-01',
      amount: '90.00',
      case: { id: T1, code: '26-00001', patientRef: 'Ana Ruiz' },
    }),
  ],
})

beforeEach(() => {
  setMatchMedia(true)
  vi.mocked(fetchClinicAccount).mockReset()
})

describe('ClinicAccountContent', () => {
  it('se titula con el nombre de la clínica, con su saldo y la vuelta a «Cuentas»', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(account('1250.00'))
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="admin" />)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Clínica Sur' }),
    ).toBeInTheDocument()
    expect(fetchClinicAccount).toHaveBeenCalledWith('c1')
    expect(screen.getByRole('region', { name: 'Saldo' })).toHaveTextContent('$ 1250.00')
    expect(screen.getByRole('link', { name: 'Cuentas' })).toHaveAttribute('href', '/cuentas')
  })

  it.each(['admin', 'recepcion'] as const)(
    '%s abre el estado de cuenta imprimible de la clínica',
    async (role) => {
      vi.mocked(fetchClinicAccount).mockResolvedValue(account('45.00'))
      renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role={role} />)
      expect(await screen.findByRole('link', { name: 'Estado de cuenta' })).toHaveAttribute(
        'href',
        '/cuentas/c1/estado',
      )
    },
  )

  it('un saldo negativo se dice «A favor»', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(account('-12.34'))
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="admin" />)
    await screen.findByRole('heading', { level: 1, name: 'Clínica Sur' })
    expect(screen.getByRole('region', { name: 'Saldo' })).toHaveTextContent('A favor $ 12.34')
  })

  it('la cabecera dice el saldo a favor, lo más antiguo y la antigüedad por cubo', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(FULL)
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="recepcion" />)
    const saldo = await screen.findByRole('region', { name: 'Saldo' })
    expect(saldo).toHaveTextContent('$ 70.00')
    expect(saldo).toHaveTextContent('Ya descuenta $ 20.00 a favor sin aplicar')
    expect(saldo).not.toHaveTextContent('Saldo a favor')
    expect(saldo).toHaveTextContent('Más antiguo: 37 días')
    expect(saldo).toHaveTextContent('31–60 días$ 70.00')
  })

  it('«Por cobrar» lista los trabajos con lo que deben y desde cuándo', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(FULL)
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="recepcion" />)
    const tab = await screen.findByRole('tab', { name: 'Por cobrar (1)' })
    expect(tab).toHaveAttribute('aria-selected', 'true')
    const row = screen.getByRole('row', { name: /26-00001/ })
    expect(row).toHaveTextContent('Ana Ruiz')
    expect(row).toHaveTextContent('37 días')
    expect(row).toHaveTextContent('$ 90.00')
    expect(within(row).getByRole('link', { name: '26-00001' })).toHaveAttribute(
      'href',
      `/trabajos/${T1}`,
    )
  })

  it('«Por cobrar» cierra con el desglose del saldo que da la API (UX5-02)', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(FULL)
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="recepcion" />)
    const panel = await screen.findByRole('tabpanel', { name: 'Por cobrar (1)' })
    const desglose = within(panel).getByLabelText('Desglose del saldo')
    expect(desglose).toHaveTextContent('Trabajos$ 90.00')
    expect(desglose).toHaveTextContent(
      'Saldo inicial y ajustes sin trabajo(desde el 02/09/2026)$ 10.00',
    )
    expect(desglose).toHaveTextContent('Saldo a favor− $ 20.00')
    expect(desglose).toHaveTextContent('Saldo$ 70.00')
  })

  it('sin trabajos por cobrar, el saldo inicial sigue a la vista en el desglose', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(
      account('245.00', {
        breakdown: {
          openCases: '0.00',
          unlinkedAdjustments: '245.00',
          unlinkedSince: '2026-08-01',
          credit: '0.00',
          balance: '245.00',
        },
      }),
    )
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="recepcion" />)
    const panel = await screen.findByRole('tabpanel', { name: 'Por cobrar (0)' })
    expect(panel).toHaveTextContent('Nada por cobrar')
    expect(within(panel).getByLabelText('Desglose del saldo')).toHaveTextContent(
      'Saldo inicial y ajustes sin trabajo(desde el 01/08/2026)$ 245.00',
    )
  })

  it('una cuenta en cero no lleva desglose', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(account('0.00'))
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="recepcion" />)
    await screen.findByRole('tabpanel', { name: 'Por cobrar (0)' })
    expect(screen.queryByLabelText('Desglose del saldo')).not.toBeInTheDocument()
  })

  it('«Movimientos» da cada uno con su signo; el anulado, tachado con quién y por qué', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(FULL)
    const { user } = renderWithQueryAndRouter(
      <ClinicAccountContent clinicId="c1" role="recepcion" />,
    )
    await user.click(await screen.findByRole('tab', { name: 'Movimientos (5)' }))

    const cargo = screen.getByRole('row', { name: /Cargo/ })
    expect(cargo).toHaveTextContent('+ $ 90.00')
    expect(cargo).toHaveTextContent('01/09/2026')
    const pago = screen.getByRole('row', { name: /TRX-1/ })
    expect(pago).toHaveTextContent('− $ 20.00')
    expect(pago).toHaveTextContent('Transferencia · TRX-1')
    expect(pago).toHaveTextContent('Le quedan $ 20.00 a favor')
    const ajuste = screen.getByRole('row', { name: /Saldo inicial/ })
    expect(ajuste).toHaveTextContent('Registrado por Ana Admin')

    const anulado = screen.getByRole('row', { name: /Anulado/ })
    expect(anulado).toHaveTextContent('Anulado por Ana Admin: Registrado dos veces')
    expect(within(anulado).getByText('− $ 30.00')).toHaveClass('line-through')
  })

  it('recepción registra pagos y aplica saldo a favor, pero no ajusta ni anula', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(FULL)
    const { user } = renderWithQueryAndRouter(
      <ClinicAccountContent clinicId="c1" role="recepcion" />,
    )
    expect(await screen.findByRole('button', { name: 'Registrar pago' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar ajuste' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Movimientos (5)' }))
    // Solo el pago con algo a favor lo ofrece; el asignado entero y el anulado, no.
    expect(screen.getAllByRole('button', { name: /^Aplicar saldo a favor de/ })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /^Anular/ })).not.toBeInTheDocument()
  })

  it('el administrador además registra ajustes y anula los pagos vigentes', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(FULL)
    const { user } = renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="admin" />)
    expect(await screen.findByRole('button', { name: 'Registrar ajuste' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Movimientos (5)' }))
    expect(screen.getAllByRole('button', { name: /^Anular pago/ })).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Anular pago de $ 20.00 del 06/10/2026' }))
    expect(await screen.findByRole('dialog', { name: 'Anular pago' })).toHaveTextContent(
      'No estaba aplicado a ningún trabajo.',
    )
  })

  // Final review M-2: el buscador de «Registrar ajuste» lista los trabajos que cargan tal como
  // los da la API, con su estado, lo que deben y lo pagado.
  it('«Registrar ajuste» lista los trabajos que cargan de la API', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue({
      ...FULL,
      billedCases: [
        {
          id: T1,
          code: '26-00001',
          patientRef: 'Ana Ruiz',
          status: 'entregado',
          outstanding: '90.00',
          allocated: '0.00',
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          code: '26-00007',
          patientRef: 'Luis Paz',
          status: 'cobrado',
          outstanding: '0.00',
          allocated: '45.00',
        },
      ],
    })
    const { user } = renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="admin" />)
    await user.click(await screen.findByRole('button', { name: 'Registrar ajuste' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar ajuste' })
    await user.click(within(dialog).getByRole('combobox', { name: 'Trabajo' }))
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Sin trabajo: solo la clínica',
      '26-00001 Ana Ruiz · Debe $ 90.00',
      '26-00007 Luis Paz · Cobrado',
    ])
  })

  it('«Anular pago» nombra los trabajos a los que se aplicó el pago de esa fila (UX5-03)', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(FULL)
    const { user } = renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="admin" />)
    await user.click(await screen.findByRole('tab', { name: 'Movimientos (5)' }))
    const row = screen.getByRole('row', { name: /05\/10\/2026/ })
    expect(row).toHaveTextContent('Aplicado a 26-00001 ($ 10.00)')
    await user.click(screen.getByRole('button', { name: 'Anular pago de $ 10.00 del 05/10/2026' }))
    expect(await screen.findByRole('dialog', { name: 'Anular pago' })).toHaveTextContent(
      'Se quita lo aplicado a 26-00001 ($ 10.00).',
    )
  })

  it('«Aplicar saldo a favor» abre el reparto de ese pago', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(FULL)
    const { user } = renderWithQueryAndRouter(
      <ClinicAccountContent clinicId="c1" role="recepcion" />,
    )
    await user.click(await screen.findByRole('tab', { name: 'Movimientos (5)' }))
    await user.click(
      screen.getByRole('button', { name: 'Aplicar saldo a favor de $ 20.00 del 06/10/2026' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Aplicar saldo a favor' })
    expect(within(dialog).getByRole('textbox', { name: 'Monto para 26-00001' })).toHaveValue(
      '20.00',
    )
  })

  it('sin trabajos por cobrar no ofrece aplicar el saldo a favor', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue({ ...FULL, openCases: [] })
    const { user } = renderWithQueryAndRouter(
      <ClinicAccountContent clinicId="c1" role="recepcion" />,
    )
    await user.click(await screen.findByRole('tab', { name: 'Movimientos (5)' }))
    expect(screen.queryByRole('button', { name: /^Aplicar saldo a favor/ })).not.toBeInTheDocument()
  })

  /** Clínica Sur (UX5-01): $ 200 a favor en dos pagos sin aplicar y un trabajo de $ 75. */
  const SUR = account('-125.00', {
    credit: '200.00',
    openCases: [
      {
        id: T1,
        code: '26-00106',
        patientRef: 'Luis Paz',
        deliveredAt: '2026-10-08T15:00:00.000Z',
        charge: '75.00',
        adjustments: '0.00',
        allocated: '0.00',
        outstanding: '75.00',
        days: 2,
      },
    ] as unknown as ClinicAccount['openCases'],
    breakdown: {
      openCases: '75.00',
      unlinkedAdjustments: '0.00',
      unlinkedSince: null,
      credit: '200.00',
      balance: '-125.00',
    },
    movements: [
      movement({
        id: 'p-nuevo',
        kind: 'pago',
        date: '2026-10-06',
        amount: '-50.00',
        method: 'efectivo',
        by: 'Rosa',
        remaining: '50.00',
        allocations: [],
      }),
      movement({
        id: 'p-viejo',
        kind: 'pago',
        date: '2026-10-03',
        amount: '-150.00',
        method: 'transferencia',
        by: 'Rosa',
        remaining: '150.00',
        allocations: [],
      }),
      movement({
        id: 'p-anulado',
        kind: 'pago',
        date: '2026-10-01',
        amount: '-30.00',
        method: 'efectivo',
        by: 'Rosa',
        remaining: '0.00',
        allocations: [],
        voided: { at: '2026-10-01T20:00:00.000Z', by: 'Ana Admin', reason: 'Duplicado' },
      } as unknown as Partial<Movement>),
    ],
  })

  /** Los botones y enlaces de la cabecera, en el orden del DOM (el del foco). */
  const headerActions = async () => {
    const group = await screen.findByRole('group', { name: 'Acciones de la cuenta' })
    return [...group.querySelectorAll('a, button')].map((el) => el.textContent?.trim())
  }

  it('la cabecera de Sur no se contradice: a favor neto y el trabajo que cubre (UX5-01)', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(SUR)
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="recepcion" />)
    const saldo = await screen.findByRole('region', { name: 'Saldo' })
    expect(saldo).toHaveTextContent('A favor $ 125.00')
    expect(saldo).toHaveTextContent('1 trabajo por cobrar ($ 75.00), cubierto por el saldo a favor')
    expect(saldo).not.toHaveTextContent('Nada pendiente')
    expect(saldo).not.toHaveTextContent('$ 200.00')
  })

  it.each(['admin', 'recepcion'] as const)(
    '%s aplica el saldo a favor desde la cabecera, con el pago vigente más antiguo (UX5-01)',
    async (role) => {
      vi.mocked(fetchClinicAccount).mockResolvedValue(SUR)
      const { user } = renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role={role} />)
      await user.click(await screen.findByRole('button', { name: 'Aplicar saldo a favor' }))
      const dialog = await screen.findByRole('dialog', { name: 'Aplicar saldo a favor' })
      expect(dialog).toHaveTextContent('Transferencia del 03/10/2026 · Clínica Sur')
      expect(within(dialog).getByRole('textbox', { name: 'Monto para 26-00106' })).toHaveValue(
        '75.00',
      )
    },
  )

  it('sin trabajos por cobrar, la cabecera no ofrece aplicar el saldo a favor', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue({ ...SUR, openCases: [] })
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="recepcion" />)
    await screen.findByRole('button', { name: 'Registrar pago' })
    expect(screen.queryByRole('button', { name: 'Aplicar saldo a favor' })).not.toBeInTheDocument()
  })

  it('sin un pago vigente con algo a favor, la cabecera no ofrece aplicarlo', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue({
      ...SUR,
      movements: SUR.movements.map((m) =>
        m.id === 'p-anulado' ? { ...m, remaining: '30.00' } : { ...m, remaining: '0.00' },
      ),
    })
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="recepcion" />)
    await screen.findByRole('button', { name: 'Registrar pago' })
    expect(screen.queryByRole('button', { name: 'Aplicar saldo a favor' })).not.toBeInTheDocument()
  })

  it('los botones de la cabecera van en orden de importancia, también para el foco (UX5-17)', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(SUR)
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="admin" />)
    expect(await headerActions()).toEqual([
      'Registrar pago',
      'Aplicar saldo a favor',
      'Registrar ajuste',
      'Estado de cuenta',
    ])
  })

  it('recepción ve los mismos botones sin «Registrar ajuste», en el mismo orden', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(SUR)
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="recepcion" />)
    expect(await headerActions()).toEqual([
      'Registrar pago',
      'Aplicar saldo a favor',
      'Estado de cuenta',
    ])
  })

  it('mientras la cuenta espera una mutación, «Aplicar saldo a favor» se bloquea como los demás', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(SUR)
    const { client } = renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="admin" />)
    const apply = await screen.findByRole('button', { name: 'Aplicar saldo a favor' })
    expect(apply).toBeEnabled()
    act(() => {
      void client
        .getMutationCache()
        .build(client, {
          mutationKey: mutationKeys.account('c1'),
          mutationFn: () => new Promise<never>(() => {}),
        })
        .execute(undefined)
    })
    expect(await screen.findByRole('button', { name: 'Aplicar saldo a favor' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeDisabled()
  })

  it('«Registrar pago» abre su diálogo', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(FULL)
    const { user } = renderWithQueryAndRouter(
      <ClinicAccountContent clinicId="c1" role="recepcion" />,
    )
    await user.click(await screen.findByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByRole('dialog', { name: 'Registrar pago' })).toBeInTheDocument()
  })

  it('en móvil, los movimientos van en tarjetas con sus acciones', async () => {
    setMatchMedia(false)
    vi.mocked(fetchClinicAccount).mockResolvedValue(FULL)
    const { user } = renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="admin" />)
    await user.click(await screen.findByRole('tab', { name: 'Movimientos (5)' }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText('Anulado por Ana Admin: Registrado dos veces')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Aplicar saldo a favor de $ 20.00 del 06/10/2026' }),
    ).toBeInTheDocument()
  })

  it('una clínica que no existe (404) lo dice, con su h1 y salida a «Cuentas»', async () => {
    vi.mocked(fetchClinicAccount).mockRejectedValue(new ApiError('No encontrado', 404))
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c-x" role="admin" />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Cuenta' })).toBeInTheDocument()
    expect(screen.getByText('La clínica no existe')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a cuentas' })).toHaveAttribute(
      'href',
      '/cuentas',
    )
  })

  it('un fallo de red no dice que no existe: ofrece reintentar, enfocado', async () => {
    vi.mocked(fetchClinicAccount).mockRejectedValue(new TypeError('Failed to fetch'))
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" role="admin" />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Cuenta' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toHaveFocus()
    expect(screen.queryByText('La clínica no existe')).not.toBeInTheDocument()
  })
})
