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
    expect(screen.getByText('$ 147.00')).toBeInTheDocument()
  })

  it('el enlace del código es un identificador de fila, exento del objetivo táctil de 44 px', async () => {
    // El código de trabajo (font-mono, sin padding propio) es el identificador de la
    // fila/tarjeta, no una acción — misma excepción "inline" (WCAG 2.5.8) que el nombre
    // de clínica en `clinics-table.tsx`. Sin `data-target-size="inline"`, el barrido de
    // `expectTouchTargets` en `accesibilidad.spec.ts` lo mide en ~23 px de alto (texto
    // `font-mono font-medium` sin `h-11`) y falla de forma determinista en cuanto la
    // lista de trabajos tiene al menos una fila.
    setMatchMedia(true)
    renderWithRouter(<CasesTable rows={rows} hidePrices={false} />)

    const link = await screen.findByRole('link', { name: /26-00123/ })
    expect(link).toHaveAttribute('data-target-size', 'inline')
  })

  it('el atraso y la urgencia se muestran como icono accesible, no como chip de texto', async () => {
    setMatchMedia(true)
    renderWithRouter(<CasesTable rows={rows} hidePrices={false} />)

    await screen.findByRole('link', { name: /26-00123/ })
    // UX2-05: liberar ancho a 1280 cambiando los chips "Urgente"/"Atrasado" por un
    // icono con título y nombre accesible — el texto sigue disponible para lectores
    // de pantalla, solo deja de ocupar una celda completa de texto.
    expect(screen.queryByText('Atrasado')).not.toBeInTheDocument()
    expect(screen.queryByText('Urgente')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Urgente' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Atrasado' })).toBeInTheDocument()
  })

  it('compacta clínica y doctor en una sola línea con el texto completo accesible', async () => {
    setMatchMedia(true)
    renderWithRouter(<CasesTable rows={rows} hidePrices={false} />)

    await screen.findByRole('link', { name: /26-00123/ })
    const cell = screen.getByText('Clínica Uno · Dr. Gómez')
    expect(cell).toHaveAttribute('title', 'Clínica Uno · Dr. Gómez')
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
