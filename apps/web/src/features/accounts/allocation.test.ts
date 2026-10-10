import { describe, expect, it } from 'vitest'
import { applyIssues, formFieldForIssue, orderOpenCases, suggestedRows } from './allocation'

const open = [
  { id: 'b', code: '26-00002', deliveredAt: '2026-09-01T15:00:00.000Z', outstanding: '30.00' },
  { id: 'a', code: '26-00001', deliveredAt: '2026-09-01T15:00:00.000Z', outstanding: '50.00' },
  { id: 'c', code: '26-00003', deliveredAt: '2026-08-20T15:00:00.000Z', outstanding: '20.00' },
]

describe('orderOpenCases', () => {
  it('de la entrega más antigua a la más nueva y, a igualdad, por código (decisión 8)', () => {
    expect(orderOpenCases(open).map((c) => c.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('suggestedRows', () => {
  it('rellena con el reparto sugerido y deja vacío lo que no alcanza', () => {
    expect(suggestedRows(orderOpenCases(open), 6000)).toEqual([
      { trabajoId: 'c', monto: '20.00' },
      { trabajoId: 'a', monto: '40.00' },
      { trabajoId: 'b', monto: '' },
    ])
  })

  it('sin monto, todas las filas vacías', () => {
    expect(suggestedRows(orderOpenCases(open), null).map((r) => r.monto)).toEqual(['', '', ''])
  })
})

describe('formFieldForIssue (422 de la API → campo del formulario)', () => {
  // El reparto que viaja quita las filas vacías: la asignación 1 de la API es la fila 2.
  const sent = [0, 2]

  it('una asignación va al monto de su fila', () => {
    expect(formFieldForIssue('asignaciones.1.monto', sent)).toBe('asignaciones.2.monto')
    expect(formFieldForIssue('asignaciones.0.trabajoId', sent)).toBe('asignaciones.0.monto')
  })

  it('el total del reparto y los campos sueltos quedan igual', () => {
    expect(formFieldForIssue('asignaciones', sent)).toBe('asignaciones')
    expect(formFieldForIssue('fecha', sent)).toBe('fecha')
  })

  it('una asignación que no se envió no tiene campo', () => {
    expect(formFieldForIssue('asignaciones.5.monto', sent)).toBeNull()
  })
})

describe('applyIssues (pinta los 422 de la API bajo su campo)', () => {
  it('pone cada error en su campo y dice si quedó alguno sin campo', () => {
    const set: [string, string][] = []
    const unmapped = applyIssues(
      [
        { path: 'fecha', message: 'La fecha no puede ser posterior a hoy' },
        { path: 'asignaciones.0.monto', message: 'Supera lo pendiente' },
      ],
      [1],
      ['fecha', 'monto'],
      (field, message) => set.push([field, message]),
    )
    expect(set).toEqual([
      ['fecha', 'La fecha no puede ser posterior a hoy'],
      ['asignaciones.1.monto', 'Supera lo pendiente'],
    ])
    expect(unmapped).toBe(false)
  })

  it('un error de un campo que el formulario no tiene queda sin pintar', () => {
    const set: string[] = []
    expect(
      applyIssues([{ path: 'clinicaId', message: 'La clínica no existe' }], [], ['fecha'], (f) =>
        set.push(f),
      ),
    ).toBe(true)
    expect(set).toEqual([])
  })

  it('sin issues no hay nada que pintar: cuenta como sin campo', () => {
    expect(applyIssues([], [], ['fecha'], () => {})).toBe(true)
  })
})
