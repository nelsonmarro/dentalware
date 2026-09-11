import { describe, expect, it } from 'vitest'
import { fakeCasesRepo, fakeUow, fixedClock } from './fakes.ts'
import { createImportService } from './import.service.ts'
import type { CatalogClinic, CatalogDoctor, CatalogProduct, ImportCatalog } from './import.ports.ts'

const CLINIC_ID = '11111111-1111-4111-8111-111111111111'
const DOCTOR_ID = '22222222-2222-4222-8222-222222222222'
const PRODUCT_ID = '33333333-3333-4333-8333-333333333333'

/** Catálogo en memoria: suficiente para probar la resolución sin Postgres. */
function fakeCatalog(
  over: {
    clinics?: CatalogClinic[]
    doctors?: CatalogDoctor[]
    products?: CatalogProduct[]
  } = {},
): ImportCatalog {
  const clinics = over.clinics ?? [{ id: CLINIC_ID, name: 'Clínica Sonrisa', active: true }]
  const doctors = over.doctors ?? [
    { id: DOCTOR_ID, name: 'Dr. Pérez', clinicId: CLINIC_ID, active: true },
  ]
  const products = over.products ?? [{ id: PRODUCT_ID, code: 'ZR', name: 'Zirconio', active: true }]
  return {
    clinics: async () => clinics,
    doctors: async () => doctors,
    products: async () => products,
  }
}

const ctx = { userId: 'u1', role: 'recepcion' as const }

describe('createImportService', () => {
  it('resuelve clínica, doctor y producto insensible a acentos y crea un trabajo por grupo con commit', async () => {
    const { repo, rows } = fakeCasesRepo()
    const service = createImportService({
      catalog: fakeCatalog(),
      uow: fakeUow(repo),
      clock: fixedClock('2026-09-09'),
    })
    const report = await service.run(
      {
        rows: [['CLINICA SONRISA', 'dr. perez', 'Ana Paciente', 'ZR', '11', '1', '', '', '', '']],
        commit: true,
      },
      ctx,
    )
    expect(report).toMatchObject({ totalRows: 1, cases: 1, errors: [] })
    expect(report.created).toHaveLength(1)
    expect(rows.size).toBe(1)
  })

  it('reporta en la misma pasada error de formato y de clínica inexistente', async () => {
    const { repo, rows } = fakeCasesRepo()
    const service = createImportService({
      catalog: fakeCatalog(),
      uow: fakeUow(repo),
      clock: fixedClock('2026-09-09'),
    })
    const report = await service.run(
      {
        rows: [
          [
            'Clínica Fantasma',
            'Dr. Pérez',
            'Ana Paciente',
            'ZR',
            '11',
            '1',
            '',
            '2026-13-40',
            '',
            '',
          ],
        ],
        commit: true,
      },
      ctx,
    )
    expect(report.errors).toEqual([
      { row: 2, column: 'clinica', message: 'La clínica "Clínica Fantasma" no existe' },
      {
        row: 2,
        column: 'fecha_deseada',
        message: 'Fecha inválida (usa AAAA-MM-DD o DD/MM/AAAA)',
      },
    ])
    expect(report.created).toEqual([])
    expect(rows.size).toBe(0)
  })

  it('sin commit no crea nada y devuelve el conteo', async () => {
    const { repo, rows } = fakeCasesRepo()
    const service = createImportService({
      catalog: fakeCatalog(),
      uow: fakeUow(repo),
      clock: fixedClock('2026-09-09'),
    })
    const report = await service.run(
      {
        rows: [['Clínica Sonrisa', 'Dr. Pérez', 'Ana Paciente', 'ZR', '11', '1', '', '', '', '']],
        commit: false,
      },
      ctx,
    )
    expect(report).toMatchObject({ totalRows: 1, cases: 1, errors: [], created: [] })
    expect(rows.size).toBe(0)
  })

  it('con cualquier error no crea nada aunque commit sea true', async () => {
    const { repo, rows } = fakeCasesRepo()
    const service = createImportService({
      catalog: fakeCatalog(),
      uow: fakeUow(repo),
      clock: fixedClock('2026-09-09'),
    })
    const report = await service.run(
      {
        rows: [
          ['Clínica Sonrisa', 'Dr. Pérez', 'Ana Paciente', 'ZR', '11', '1', '', '', '', ''],
          ['Clínica Fantasma', 'Dr. Pérez', 'Otro Paciente', 'ZR', '12', '1', '', '', '', ''],
        ],
        commit: true,
      },
      ctx,
    )
    expect(report.errors).toEqual([
      { row: 3, column: 'clinica', message: 'La clínica "Clínica Fantasma" no existe' },
    ])
    expect(report.created).toEqual([])
    expect(rows.size).toBe(0)
  })

  it('todos los trabajos del mismo archivo comparten receivedAt aunque el reloj cambie entre grupos', async () => {
    const { repo, rows } = fakeCasesRepo()
    const dates = ['2026-09-09', '2026-09-10']
    let call = 0
    const changingClock = {
      today: () => dates[Math.min(call++, dates.length - 1)]!,
      now: () => new Date(`${dates[0]}T12:00:00Z`),
    }
    const service = createImportService({
      catalog: fakeCatalog(),
      uow: fakeUow(repo),
      clock: changingClock,
    })
    const report = await service.run(
      {
        rows: [
          ['Clínica Sonrisa', 'Dr. Pérez', 'Paciente Uno', 'ZR', '11', '1', '', '', '', ''],
          ['Clínica Sonrisa', 'Dr. Pérez', 'Paciente Dos', 'ZR', '12', '1', '', '', '', ''],
        ],
        commit: true,
      },
      ctx,
    )
    expect(report.created).toHaveLength(2)
    const receivedDates = new Set([...rows.values()].map((r) => r.receivedAt))
    expect(receivedDates).toEqual(new Set(['2026-09-09']))
  })
})
