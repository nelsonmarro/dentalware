import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import type { ClinicAccount } from './api'
import { OpenCasesTable } from './open-cases-table'

const ROWS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    code: '26-00105',
    patientRef: 'Paciente UX It5 A',
    deliveredAt: '2026-09-01T15:00:00.000Z',
    charge: '90.00',
    adjustments: '10.00',
    allocated: '45.00',
    outstanding: '55.00',
    days: 37,
  },
] as unknown as ClinicAccount['openCases']

/** El `span` cuyo texto completo es `text`. */
const spanWith = (text: string) =>
  screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === text)

describe('OpenCasesTable — tarjeta móvil', () => {
  it('cada etiqueta con su monto no se parte («Pagado $» / «45.00» a 360)', async () => {
    setMatchMedia(false)
    renderWithRouter(<OpenCasesTable rows={ROWS} />)
    await screen.findByRole('link', { name: '26-00105' })
    for (const text of ['Cargo $ 90.00', 'Ajustes + $ 10.00', 'Pagado $ 45.00']) {
      expect(spanWith(text)).toHaveClass('whitespace-nowrap')
    }
  })

  it('el código del trabajo no se parte', async () => {
    setMatchMedia(false)
    renderWithRouter(<OpenCasesTable rows={ROWS} />)
    expect(await screen.findByRole('link', { name: '26-00105' })).toHaveClass('whitespace-nowrap')
  })
})
