import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { renderWithQueryAndRouter } from '@/test/render'
import { type ClinicAccount, fetchClinicAccount } from './api'
import { ClinicAccountContent } from './clinic-account-content'

vi.mock('./api', () => ({ fetchClinicAccount: vi.fn() }))

const zero = { '0_30': '0.00', '31_60': '0.00', '61_90': '0.00', '90_mas': '0.00' }
const account = (balance: string) =>
  ({
    clinic: { id: 'c1', name: 'Clínica Sur' },
    balance,
    credit: '0.00',
    aging: zero,
    oldestDays: null,
    openCases: [],
    movements: [],
  }) as unknown as ClinicAccount

describe('ClinicAccountContent', () => {
  it('se titula con el nombre de la clínica, con su saldo y la vuelta a «Cuentas»', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(account('1250.00'))
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" />)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Clínica Sur' }),
    ).toBeInTheDocument()
    expect(fetchClinicAccount).toHaveBeenCalledWith('c1')
    expect(screen.getByText('Saldo').parentElement).toHaveTextContent('Saldo$ 1250.00')
    expect(screen.getByRole('link', { name: 'Cuentas' })).toHaveAttribute('href', '/cuentas')
  })

  it('un saldo negativo se dice «A favor»', async () => {
    vi.mocked(fetchClinicAccount).mockResolvedValue(account('-12.34'))
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" />)
    await screen.findByRole('heading', { level: 1, name: 'Clínica Sur' })
    expect(screen.getByText('Saldo').parentElement).toHaveTextContent('A favor $ 12.34')
  })

  it('una clínica que no existe (404) lo dice, con su h1 y salida a «Cuentas»', async () => {
    vi.mocked(fetchClinicAccount).mockRejectedValue(new ApiError('No encontrado', 404))
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c-x" />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Cuenta' })).toBeInTheDocument()
    expect(screen.getByText('La clínica no existe')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a cuentas' })).toHaveAttribute(
      'href',
      '/cuentas',
    )
  })

  it('un fallo de red no dice que no existe: ofrece reintentar, enfocado', async () => {
    vi.mocked(fetchClinicAccount).mockRejectedValue(new TypeError('Failed to fetch'))
    renderWithQueryAndRouter(<ClinicAccountContent clinicId="c1" />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Cuenta' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toHaveFocus()
    expect(screen.queryByText('La clínica no existe')).not.toBeInTheDocument()
  })
})
