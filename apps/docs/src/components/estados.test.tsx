import { render, screen, within } from '@testing-library/react'
import {
  CASE_ACTION_LABEL,
  CASE_ACTIONS,
  CASE_STATUS_LABEL,
  CASE_STATUSES,
} from '@dentalware/shared'
import { describe, expect, it } from 'vitest'
import { Estados } from './estados'

function diagrama(container: HTMLElement): string {
  const pre = container.querySelector('pre[data-mermaid]')
  if (!pre) throw new Error('No se pintó el diagrama')
  return pre.textContent ?? ''
}

describe('Estados', () => {
  it('el diagrama nombra cada estado y cada acción salvo cancelar', () => {
    const { container } = render(<Estados />)
    const texto = diagrama(container)
    for (const estado of CASE_STATUSES) expect(texto).toContain(`"${CASE_STATUS_LABEL[estado]}"`)
    for (const accion of CASE_ACTIONS.filter((a) => a !== 'cancelar')) {
      expect(texto).toContain(`"${CASE_ACTION_LABEL[accion]}"`)
    }
    expect(texto).not.toContain('Cancelar trabajo')
  })

  it('el diagrama une los estados con una flecha por acción (literal: Recibido y En proceso)', () => {
    const { container } = render(<Estados />)
    const texto = diagrama(container)
    expect(texto).toMatch(/^flowchart /)
    expect(texto).toContain('por_recoger -->|"Recibido"| nuevo')
    expect(texto).toContain('en_proceso -->|"Pausar"| en_espera')
    expect(texto).toContain('en_proceso -->|"Finalizar"| terminado')
  })

  it('la figura tiene un nombre que remite a la tabla y se enfoca (en el teléfono se desplaza)', () => {
    render(<Estados />)
    const figura = screen.getByRole('img', {
      name: 'Diagrama de los estados de un trabajo y las acciones que los cambian; la tabla de abajo tiene lo mismo',
    })
    expect(figura).toHaveAttribute('tabindex', '0')
  })

  it('la tabla tiene una fila por transición, con sus roles', () => {
    render(<Estados />)
    const tabla = screen.getByRole('table')
    const filas = within(tabla).getAllByRole('row')
    expect(filas).toHaveLength(CASE_ACTIONS.length + 1)
    expect(
      within(filas[0] as HTMLElement)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Acción', 'De', 'A', 'Quién'])

    const cancelar = within(tabla).getByRole('row', { name: /Cancelar trabajo/ })
    expect(
      within(cancelar)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual([
      'Cancelar trabajo',
      'Por recoger, Nuevo, En proceso, En espera, En prueba, Terminado, Enviado',
      'Cancelado',
      'Administrador, Recepción',
    ])

    const finalizar = within(tabla).getByRole('row', { name: /Finalizar/ })
    expect(within(finalizar).getAllByRole('cell').at(-1)).toHaveTextContent(
      'Administrador, Recepción, Técnico',
    )
  })

  it('la nota de cancelar nombra los estados desde los que no se puede', () => {
    render(<Estados />)
    const nota = screen.getByText(
      (_, el) => el?.tagName === 'P' && (el.textContent ?? '').startsWith('Cancelar trabajo'),
    )
    expect(nota).toHaveTextContent(
      'Cancelar trabajo no sale en el diagrama: lleva a Cancelado desde cualquier estado salvo Entregado, Cobrado y Cancelado.',
    )
  })
})
