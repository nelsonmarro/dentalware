import { toIsoDate } from '@dentalware/shared'
import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchLabSettings, type LabSettings } from '@/features/config/api'
import { ApiError } from '@/lib/api-error'
import { renderWithQueryAndRouter } from '@/test/render'
import { AccountStatementPage } from './account-statement-page'
import { type AccountStatement, fetchAccountStatement } from './api'

vi.mock('./api', () => ({ fetchAccountStatement: vi.fn() }))
vi.mock('@/features/config/api', () => ({ fetchLabSettings: vi.fn() }))

const zero = { '0_30': '0.00', '31_60': '0.00', '61_90': '0.00', '90_mas': '0.00' }
const STATEMENT = {
  clinic: { id: 'c1', name: 'Clínica Sur', ruc: null, address: null, city: null, phone: null },
  range: { desde: '2026-09-01', hasta: '2026-09-30' },
  openingDate: '2026-08-31',
  openingBalance: '0.00',
  movements: [],
  totals: { cargo: '0.00', ajuste: '0.00', pago: '0.00' },
  closingBalance: '45.00',
  credit: '0.00',
  aging: zero,
  oldestDays: null,
  openCases: [],
} as unknown as AccountStatement

const RANGE = { desde: '2026-09-01', hasta: '2026-09-30' }

function renderPage(onRangeChange = vi.fn()) {
  const r = renderWithQueryAndRouter(
    <AccountStatementPage clinicId="c1" range={RANGE} onRangeChange={onRangeChange} />,
  )
  return { ...r, onRangeChange }
}

describe('AccountStatementPage (/cuentas/$clinicaId/estado, CTA-5)', () => {
  beforeEach(() => {
    vi.mocked(fetchAccountStatement).mockResolvedValue(STATEMENT)
    vi.mocked(fetchLabSettings).mockResolvedValue({ name: 'Arte Dental' } as LabSettings)
  })
  afterEach(() => vi.restoreAllMocks())

  it('pide el estado de la clínica con el rango y lo muestra con el laboratorio', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Estado de cuenta' })).toBeVisible()
    expect(fetchAccountStatement).toHaveBeenCalledWith('c1', RANGE)
    expect(screen.getByText('Arte Dental')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Volver a la cuenta' })).toHaveAttribute(
      'href',
      '/cuentas/c1',
    )
  })

  it('«Imprimir» abre el diálogo de impresión del navegador', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Imprimir' }))
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('los controles no se imprimen', async () => {
    renderPage()
    const print = await screen.findByRole('button', { name: 'Imprimir' })
    expect(print.closest('.print\\:hidden')).not.toBeNull()
    expect(screen.getByLabelText('Desde').closest('.print\\:hidden')).not.toBeNull()
  })

  it('cambiar el periodo lo pide con las fechas nuevas', async () => {
    const { user, onRangeChange } = renderPage()
    const desde = await screen.findByLabelText('Desde')
    expect(desde).toHaveValue('2026-09-01')
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-09-30')
    await user.clear(desde)
    await user.type(desde, '2026-08-01')
    await user.click(screen.getByRole('button', { name: 'Ver periodo' }))
    expect(onRangeChange).toHaveBeenCalledWith({ desde: '2026-08-01', hasta: '2026-09-30' })
  })

  it('una fecha final anterior a la inicial se avisa bajo el campo y no se pide', async () => {
    const { user, onRangeChange } = renderPage()
    const hasta = await screen.findByLabelText('Hasta')
    await user.clear(hasta)
    await user.type(hasta, '2026-08-15')
    await user.click(screen.getByRole('button', { name: 'Ver periodo' }))
    expect(
      await screen.findByText('La fecha final no puede ser anterior a la inicial'),
    ).toBeVisible()
    expect(hasta).toHaveAttribute('aria-invalid', 'true')
    expect(onRangeChange).not.toHaveBeenCalled()
  })

  // I-2 de la revisión final del PR 2: la API no acepta una fecha final posterior a hoy (la
  // antigüedad saldría proyectada). El campo no la ofrece y, si se escribe, se avisa sin pedirla.
  it('«Hasta» no pasa de hoy: el campo tiene su máximo y una fecha futura se avisa', async () => {
    const { user, onRangeChange } = renderPage()
    const hasta = await screen.findByLabelText('Hasta')
    const today = toIsoDate(new Date())
    expect(hasta).toHaveAttribute('max', today)
    expect(screen.getByLabelText('Desde')).toHaveAttribute('max', today)
    await user.clear(hasta)
    await user.type(hasta, '2999-12-31')
    await user.click(screen.getByRole('button', { name: 'Ver periodo' }))
    expect(await screen.findByText('La fecha final no puede ser posterior a hoy')).toBeVisible()
    expect(hasta).toHaveAttribute('aria-invalid', 'true')
    expect(onRangeChange).not.toHaveBeenCalled()
  })

  it('una clínica que no existe lo dice, con su h1', async () => {
    vi.mocked(fetchAccountStatement).mockRejectedValue(new ApiError('No encontrado', 404))
    renderPage()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'La clínica no existe' }),
    ).toBeVisible()
  })

  it('un fallo de red no se muestra como dato: «Reintentar»', async () => {
    vi.mocked(fetchAccountStatement).mockRejectedValue(new ApiError('Error', 500))
    renderPage()
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 1, name: 'Estado de cuenta' })).toBeVisible()
  })
})
