import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { CaseEvent } from './api'
import { CaseHistory } from './case-history'

function event(overrides: Partial<CaseEvent>): CaseEvent {
  return {
    id: 'e1',
    caseId: 'c1',
    type: 'created',
    fromValue: null,
    toValue: null,
    reason: null,
    actorId: 'u1',
    actor: { id: 'u1', name: 'Ana' },
    createdAt: new Date().toISOString(),
    ...overrides,
  } as CaseEvent
}

describe('CaseHistory', () => {
  it('muestra el trabajo creado y un comentario con su texto y autor, en orden ascendente', () => {
    renderWithProviders(
      <CaseHistory
        events={[
          event({ id: 'e1', type: 'created', toValue: 'AA-00001' }),
          event({
            id: 'e2',
            type: 'comment',
            toValue: 'Todo listo para retirar',
            actor: { id: 'u2', name: 'Beto' },
          }),
        ]}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Trabajo creado')
    expect(items[1]).toHaveTextContent('Comentario')
    expect(items[1]).toHaveTextContent('Beto')
    expect(items[1]).toHaveTextContent('Todo listo para retirar')
  })

  it('sin eventos muestra un mensaje de "sin actividad"', () => {
    renderWithProviders(<CaseHistory events={[]} />)
    expect(screen.getByText('Sin actividad todavía.')).toBeInTheDocument()
  })
})
