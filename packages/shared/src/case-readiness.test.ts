import { describe, expect, it } from 'vitest'
import { missingForAccept } from './case-readiness.ts'

const ok = () => ({
  clinicId: 'c',
  doctorId: 'd',
  patientRef: 'P1',
  dueDate: '2026-09-15',
  shade: 'A2',
  prescription: 'Corona',
  hasPrescriptionDocument: false,
  checklist: { antagonista: true, mordida: true, color: true, fotos: false },
  items: [{ pricingUnit: 'por_pieza' as const, teeth: [11] }],
})

describe('missingForAccept', () => {
  it('no falta nada en un trabajo completo', () => {
    expect(missingForAccept(ok())).toEqual([])
  })
  it('lista lo que falta en español', () => {
    expect(missingForAccept({ ...ok(), doctorId: null, patientRef: '', dueDate: null })).toEqual([
      'Doctor',
      'Referencia del paciente',
      'Fecha deseada',
    ])
  })
  it('exige piezas en líneas por pieza, no en arcada ni trabajo', () => {
    expect(missingForAccept({ ...ok(), items: [{ pricingUnit: 'por_pieza', teeth: [] }] })).toEqual(
      ['Piezas de la línea 1'],
    )
    expect(
      missingForAccept({ ...ok(), items: [{ pricingUnit: 'por_arcada', teeth: [] }] }),
    ).toEqual([])
    expect(missingForAccept({ ...ok(), items: [] })).toEqual(['Al menos una línea de trabajo'])
  })
  it('acepta prescripción en texto o como documento adjunto', () => {
    expect(missingForAccept({ ...ok(), prescription: null })).toEqual([
      'Prescripción (texto o documento)',
    ])
    expect(
      missingForAccept({ ...ok(), prescription: null, hasPrescriptionDocument: true }),
    ).toEqual([])
  })
  it('exige color cuando el trabajo lo requiere', () => {
    expect(missingForAccept({ ...ok(), shade: null, requiresShade: true })).toEqual(['Color'])
    expect(missingForAccept({ ...ok(), shade: null })).toEqual([])
  })
})
