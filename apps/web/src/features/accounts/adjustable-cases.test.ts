import { describe, expect, it } from 'vitest'
import { adjustableCases } from './adjustable-cases'

describe('adjustableCases (los trabajos a los que se puede ligar un ajuste)', () => {
  it('cada trabajo con cargo, una vez, con su paciente, lo que debe y lo pagado si está por cobrar', () => {
    expect(
      adjustableCases(
        [
          { kind: 'pago', case: null },
          { kind: 'cargo', case: { id: 't2', code: '26-00002', patientRef: 'Luis Paz' } },
          { kind: 'ajuste', case: { id: 't1', code: '26-00001', patientRef: 'Ana Ruiz' } },
          { kind: 'cargo', case: { id: 't1', code: '26-00001', patientRef: 'Ana Ruiz' } },
        ],
        [{ id: 't1', outstanding: '50.00', allocated: '20.00' }],
      ),
    ).toEqual([
      {
        id: 't1',
        code: '26-00001',
        patientRef: 'Ana Ruiz',
        outstanding: '50.00',
        allocated: '20.00',
      },
      { id: 't2', code: '26-00002', patientRef: 'Luis Paz', outstanding: null, allocated: null },
    ])
  })
})
