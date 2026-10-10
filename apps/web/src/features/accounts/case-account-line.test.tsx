import type { CaseAccount } from '@dentalware/shared'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithRouter } from '@/test/router'
import { paragraph } from '@/test/text'
import { CaseAccountLine } from './case-account-line'

const pending: CaseAccount = {
  charge: '90.00',
  adjustments: '-10.00',
  allocated: '30.00',
  outstanding: '50.00',
  paidAt: null,
}

describe('CaseAccountLine (la cuenta del trabajo en su ficha)', () => {
  it('un trabajo por cobrar dice cuánto falta de lo que se debe por él, con enlace a la cuenta', async () => {
    renderWithRouter(
      <CaseAccountLine
        account={pending}
        clinicId="k1"
        total="90.00"
        remakeChargePct={null}
        role="recepcion"
      />,
    )
    // Lo que se debe por el trabajo es su neto: cargo $ 90.00 − descuento $ 10.00.
    expect(await screen.findByText(paragraph('Pendiente $ 50.00 de $ 80.00'))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver cuenta de la clínica' })).toHaveAttribute(
      'href',
      '/cuentas/k1',
    )
  })

  // UX5-16: la cabecera dice «Total $ 45.00» y la línea «de $ 55.00»; la diferencia son los
  // ajustes del trabajo, y la línea lo dice con signo y lo que cambia lo que se cobra.
  it('con un recargo explica la diferencia con el total: ajustes con signo y lo que se cobra', async () => {
    renderWithRouter(
      <CaseAccountLine
        account={{
          charge: '45.00',
          adjustments: '10.00',
          allocated: '45.00',
          outstanding: '10.00',
          paidAt: null,
        }}
        clinicId="k1"
        total="45.00"
        remakeChargePct={null}
        role="admin"
      />,
    )
    expect(await screen.findByText(paragraph('Pendiente $ 10.00 de $ 55.00'))).toBeInTheDocument()
    expect(
      screen.getByText(
        paragraph('Incluye ajustes de + $ 10.00: se cobra $ 55.00 en vez de $ 45.00'),
      ),
    ).toBeInTheDocument()
  })

  it('con un descuento, el ajuste va con signo menos, también ya cobrado', async () => {
    renderWithRouter(
      <CaseAccountLine
        account={{
          ...pending,
          allocated: '80.00',
          outstanding: '0.00',
          paidAt: '2026-10-08T17:00:00.000Z',
        }}
        clinicId="k1"
        total="90.00"
        remakeChargePct={null}
        role="recepcion"
      />,
    )
    expect(await screen.findByText(paragraph('Cobrado el 08/10'))).toBeInTheDocument()
    expect(
      screen.getByText(
        paragraph('Incluye ajustes de − $ 10.00: se cobra $ 80.00 en vez de $ 90.00'),
      ),
    ).toBeInTheDocument()
  })

  // Con una repetición al 50 %, los ajustes cambian lo que se cobra (el cargo), no el «Total».
  it('en una repetición con ajustes, los ajustes cambian lo que se cobra y no el total', async () => {
    renderWithRouter(
      <CaseAccountLine
        account={{
          charge: '45.00',
          adjustments: '10.00',
          allocated: '0.00',
          outstanding: '55.00',
          paidAt: null,
        }}
        clinicId="k1"
        total="90.00"
        remakeChargePct="50.00"
        role="admin"
      />,
    )
    expect(
      await screen.findByText(
        paragraph('Repetición al 50 %: se cobra $ 45.00, no el total de $ 90.00'),
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        paragraph('Incluye ajustes de + $ 10.00: se cobra $ 55.00 en vez de $ 45.00'),
      ),
    ).toBeInTheDocument()
  })

  // A 360 px, «se cobra $» / «55.00» se partía: cada monto (con su signo) no se parte.
  it('los montos de la línea de ajustes no se parten', async () => {
    renderWithRouter(
      <CaseAccountLine
        account={{
          charge: '45.00',
          adjustments: '10.00',
          allocated: '45.00',
          outstanding: '10.00',
          paidAt: null,
        }}
        clinicId="k1"
        total="45.00"
        remakeChargePct={null}
        role="admin"
      />,
    )
    for (const text of ['+ $ 10.00', '$ 55.00', '$ 45.00']) {
      for (const el of await screen.findAllByText(text)) expect(el).toHaveClass('whitespace-nowrap')
    }
  })

  it('sin ajustes no añade la línea de ajustes', async () => {
    renderWithRouter(
      <CaseAccountLine
        account={{ ...pending, adjustments: '0.00', outstanding: '60.00' }}
        clinicId="k1"
        total="90.00"
        remakeChargePct={null}
        role="admin"
      />,
    )
    await screen.findByText(paragraph('Pendiente $ 60.00 de $ 90.00'))
    expect(screen.queryByText(/Incluye ajustes/)).not.toBeInTheDocument()
  })

  it('un trabajo cobrado dice el día en que se cobró', async () => {
    renderWithRouter(
      <CaseAccountLine
        account={{
          ...pending,
          allocated: '80.00',
          outstanding: '0.00',
          paidAt: '2026-10-08T17:00:00.000Z',
        }}
        clinicId="k1"
        total="90.00"
        remakeChargePct={null}
        role="admin"
      />,
    )
    expect(await screen.findByText(paragraph('Cobrado el 08/10'))).toBeInTheDocument()
    expect(screen.queryByText(/Pendiente/)).not.toBeInTheDocument()
  })

  // Nota de la Tarea 6: la cabecera dice «Total $ 25.00» (el precio de las líneas), pero de una
  // repetición al 0 % no se cobra nada: la línea lo aclara.
  it('una repetición al 0 % cobrada aclara que se cobra $ 0.00 y no el total', async () => {
    renderWithRouter(
      <CaseAccountLine
        account={{
          charge: '0.00',
          adjustments: '0.00',
          allocated: '0.00',
          outstanding: '0.00',
          paidAt: '2026-10-08T17:00:00.000Z',
        }}
        clinicId="k1"
        total="25.00"
        remakeChargePct="0.00"
        role="admin"
      />,
    )
    expect(await screen.findByText(paragraph('Cobrado el 08/10'))).toBeInTheDocument()
    expect(
      screen.getByText(paragraph('Repetición al 0 %: se cobra $ 0.00, no el total de $ 25.00')),
    ).toBeInTheDocument()
  })

  it('una repetición al 100 % no añade la aclaración', async () => {
    renderWithRouter(
      <CaseAccountLine
        account={pending}
        clinicId="k1"
        total="90.00"
        remakeChargePct="100.00"
        role="admin"
      />,
    )
    await screen.findByText(paragraph('Pendiente $ 50.00 de $ 80.00'))
    expect(screen.queryByText(/Repetición al/)).not.toBeInTheDocument()
  })

  it('sin cuenta (técnico, mensajero o trabajo sin entregar) no pinta nada', () => {
    const { container } = renderWithRouter(
      <CaseAccountLine
        account={null}
        clinicId="k1"
        total="90.00"
        remakeChargePct={null}
        role="tecnico"
      />,
    )
    expect(container).toHaveTextContent('')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('aunque llegara una cuenta, un rol sin acceso a cuentas no la ve', async () => {
    const { container } = renderWithRouter(
      <CaseAccountLine
        account={pending}
        clinicId="k1"
        total="90.00"
        remakeChargePct={null}
        role="mensajero"
      />,
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(container).not.toHaveTextContent(/Pendiente|Cobrado/)
  })
})
