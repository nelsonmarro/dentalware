import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import type { CaseListRow } from './api'
import { CasesTable } from './cases-table'

const rows: CaseListRow[] = [
  {
    id: 'caso-1',
    code: '26-00123',
    boxNumber: '12',
    patientRef: 'Juan Pérez',
    status: 'en_proceso',
    priority: 'urgente',
    receivedAt: '2026-09-01',
    dueDate: '2020-01-01',
    promisedDate: null,
    total: '147.00',
    clinic: { id: 'clinica-1', name: 'Clínica Uno' },
    doctor: { id: 'doctor-1', name: 'Dr. Gómez' },
    stage: null,
    technician: null,
    itemsSummary: 'Corona ×2',
  },
  {
    id: 'caso-2',
    code: '26-00124',
    boxNumber: null,
    patientRef: 'María López',
    status: 'nuevo',
    priority: 'normal',
    receivedAt: '2026-09-05',
    dueDate: '2026-12-31',
    promisedDate: null,
    total: '80.00',
    clinic: { id: 'clinica-1', name: 'Clínica Uno' },
    doctor: { id: 'doctor-2', name: 'Dra. Ruiz' },
    stage: null,
    technician: null,
    itemsSummary: 'Placa',
  },
]

describe('CasesTable', () => {
  it('en escritorio muestra el código como enlace, el chip, el atraso y el total', async () => {
    setMatchMedia(true)
    renderWithRouter(<CasesTable rows={rows} hidePrices={false} />)

    const link = await screen.findByRole('link', { name: /26-00123/ })
    expect(link).toHaveAttribute('href', '/trabajos/caso-1')
    expect(screen.getByText('En proceso')).toBeInTheDocument()
    expect(screen.getByText('Atrasado')).toBeInTheDocument()
    expect(screen.getByText('$ 147.00')).toBeInTheDocument()
  })

  it('oculta la columna Total cuando hidePrices es verdadero', async () => {
    setMatchMedia(true)
    renderWithRouter(<CasesTable rows={rows} hidePrices />)

    await screen.findByRole('link', { name: /26-00123/ })
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
    expect(screen.queryByText('$ 147.00')).not.toBeInTheDocument()
  })

  it('en móvil muestra tarjetas con el mismo código', async () => {
    setMatchMedia(false)
    renderWithRouter(<CasesTable rows={rows} hidePrices={false} />)

    const link = await screen.findByRole('link', { name: /26-00123/ })
    expect(link).toBeInTheDocument()
    expect(screen.getByText('$ 147.00')).toBeInTheDocument()
  })
})
