import { render, screen, within } from '@testing-library/react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { describe, expect, it } from 'vitest'
import { AllocationFields, type AllocationCase } from './allocation-fields'

const CASES: AllocationCase[] = [
  { id: 't1', code: '26-00101', patientRef: 'Ana', outstanding: '45.00', days: 40 },
  { id: 't2', code: '26-00103', patientRef: 'Luis', outstanding: '240.00', days: 12 },
  { id: 't3', code: '26-00104', patientRef: 'Rosa', outstanding: '50.00', days: 5 },
  { id: 't4', code: '26-00105', patientRef: 'Juan', outstanding: '30.00', days: 1 },
]

/** El registro de react-hook-form no importa aquí: la fila lee su monto de `amounts`. */
const field = (i: number): UseFormRegisterReturn => ({
  name: `asignaciones.${i}.monto`,
  onChange: async () => {},
  onBlur: async () => {},
  ref: () => {},
})

function renderFields(
  amounts: string[],
  rowError: (i: number) => string | undefined = () => undefined,
) {
  render(
    <AllocationFields
      cases={CASES}
      amounts={amounts}
      field={field}
      rowError={rowError}
      emptyText="No hay trabajos por cobrar."
    />,
  )
}

const row = (code: string) =>
  screen.getByRole('textbox', { name: `Monto para ${code}` }).closest('li') as HTMLElement

describe('AllocationFields (reparto entre trabajos por cobrar)', () => {
  // UX5-15: cada fila dice qué le pasará a su trabajo con el monto escrito.
  describe('consecuencia por fila', () => {
    it('el monto exacto de lo que debe: «Queda cobrado»', () => {
      renderFields(['45.00', '', '', ''])
      expect(within(row('26-00101')).getByText('Queda cobrado')).toBeInTheDocument()
      expect(
        screen.getByRole('textbox', { name: 'Monto para 26-00101' }),
      ).toHaveAccessibleDescription('Queda cobrado')
    })

    it('un monto parcial: «Quedará debiendo $ X» con lo que falta', () => {
      renderFields(['', '49.50', '', ''])
      expect(
        screen.getByRole('textbox', { name: 'Monto para 26-00103' }),
      ).toHaveAccessibleDescription('Quedará debiendo $ 190.50')
      // El monto, en monoespaciada.
      expect(within(row('26-00103')).getByText('$ 190.50')).toHaveClass('font-mono')
    })

    it('más de lo que debe: «Supera lo que debe en $ X»', () => {
      renderFields(['', '', '80', ''])
      expect(
        screen.getByRole('textbox', { name: 'Monto para 26-00104' }),
      ).toHaveAccessibleDescription('Supera lo que debe en $ 30.00')
    })

    it('sin monto o en cero no añade nada: la fila ya dice lo que debe', () => {
      renderFields(['', '49.50', '', '0'])
      for (const code of ['26-00101', '26-00105']) {
        const r = row(code)
        expect(
          within(r).queryByText(/Queda cobrado|Quedará debiendo|Supera lo que debe/),
        ).toBeNull()
      }
      expect(within(row('26-00101')).getByText('$ 45.00')).toBeInTheDocument()
    })

    it('con error en la fila, se ve el error y no la consecuencia', () => {
      renderFields(['', '', '80', ''], (i) =>
        i === 2 ? 'Supera lo pendiente del trabajo (50.00)' : undefined,
      )
      const r = row('26-00104')
      expect(within(r).getByText('Supera lo pendiente del trabajo (50.00)')).toBeInTheDocument()
      expect(within(r).queryByText(/Supera lo que debe en/)).toBeNull()
    })
  })

  // UX5-06: con muchos trabajos la lista se desplaza sola, y el total va fuera de ella (en el
  // pie del diálogo, `AllocationSummary`).
  it('la lista tiene nombre y su propio desplazamiento, sin el total dentro', () => {
    renderFields(['45.00', '', '', ''])
    const list = screen.getByRole('list', { name: 'Trabajos por cobrar' })
    expect(list).toHaveClass('overflow-y-auto')
    expect(list.className).toMatch(/max-h-/)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('sin trabajos, solo el texto vacío', () => {
    render(
      <AllocationFields
        cases={[]}
        amounts={[]}
        field={field}
        rowError={() => undefined}
        emptyText="No hay trabajos por cobrar."
      />,
    )
    expect(screen.getByText('No hay trabajos por cobrar.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })
})
