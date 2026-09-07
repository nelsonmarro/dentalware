import { IMPORT_COLUMNS, toCsv } from '@dentalware/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import { createUser, loginAs, setupTestDb, truncateAll } from '../../test/setup.ts'

describe('/api/trabajos/importar', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let recepcion: string
  let tecnico: string

  beforeAll(async () => {
    ctx = await setupTestDb()
    app = createApp({
      auth: ctx.auth,
      db: ctx.db,
      webOrigin: ctx.config.WEB_ORIGIN,
      storage: ctx.storage,
    })
  })
  afterAll(async () => {
    await ctx.pool.end()
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    await createUser(ctx.auth, ctx.db, {
      email: 'recep@t.local',
      password: 'Recep12345!',
      name: 'Recepción',
      role: 'recepcion',
    })
    await createUser(ctx.auth, ctx.db, {
      email: 'tec@t.local',
      password: 'Tecnico123!',
      name: 'Ana Técnico',
      role: 'tecnico',
    })
    recepcion = await loginAs(app, 'recep@t.local', 'Recep12345!')
    tecnico = await loginAs(app, 'tec@t.local', 'Tecnico123!')

    const [clinic] = await ctx.db
      .insert(ctx.schema.clinics)
      .values({ name: 'Clínica Sonrisa' })
      .returning()
    await ctx.db.insert(ctx.schema.doctors).values({ clinicId: clinic!.id, name: 'Dr. Pérez' })
    const [category] = await ctx.db
      .insert(ctx.schema.productCategories)
      .values({ name: 'Prótesis fija' })
      .returning()
    await ctx.db.insert(ctx.schema.products).values([
      {
        code: 'ZR',
        name: 'Zirconio',
        categoryId: category!.id,
        pricingUnit: 'por_pieza',
        basePrice: '45.00',
      },
      {
        code: 'AC',
        name: 'Acrílico',
        categoryId: category!.id,
        pricingUnit: 'por_arcada',
        basePrice: '80.00',
      },
    ])
  })

  function upload(cookie: string, csv: string, confirmar: boolean) {
    const form = new FormData()
    form.set('file', new File([csv], 'trabajos.csv', { type: 'text/csv' }))
    return app.request(`/api/trabajos/importar?confirmar=${confirmar}`, {
      method: 'POST',
      headers: { cookie, origin: ctx.config.WEB_ORIGIN },
      body: form,
    })
  }

  function csvOf(rows: string[][]) {
    return toCsv([[...IMPORT_COLUMNS], ...rows])
  }

  it('la plantilla se puede descargar con cabeceras CSV y una fila de ejemplo', async () => {
    const r = await app.request('/api/trabajos/importar/plantilla', {
      headers: { cookie: recepcion, origin: ctx.config.WEB_ORIGIN },
    })
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(r.headers.get('content-disposition')).toContain('filename="plantilla-trabajos.csv"')
    const text = await r.text()
    const [header] = text.split('\r\n')
    expect(header).toBe(IMPORT_COLUMNS.join(','))
  })

  it('3 filas que forman 2 trabajos: valida sin crear nada si confirmar=false', async () => {
    const csv = csvOf([
      // usa mayúsculas/sin tildes para probar la normalización de nombres
      ['CLINICA SONRISA', 'dr. perez', 'Ana Paciente', 'ZR', '11', '1', '', '2026-09-20', '', ''],
      ['Clínica Sonrisa', 'Dr. Pérez', 'Ana Paciente', 'AC', '', '1', '', '2026-09-20', '', ''],
      ['Clínica Sonrisa', 'Dr. Pérez', 'Otro Paciente', 'ZR', '12', '1', '', '2026-09-21', '', ''],
    ])
    const r = await upload(recepcion, csv, false)
    expect(r.status).toBe(200)
    const report = (await r.json()) as {
      totalRows: number
      cases: number
      errors: unknown[]
      created: string[]
    }
    expect(report).toMatchObject({ totalRows: 3, cases: 2, errors: [], created: [] })

    const count = await ctx.db.select().from(ctx.schema.cases)
    expect(count).toHaveLength(0)
  })

  it('con confirmar=true crea los trabajos con sus líneas y precios resueltos', async () => {
    const csv = csvOf([
      ['Clínica Sonrisa', 'Dr. Pérez', 'Ana Paciente', 'ZR', '11', '1', '', '2026-09-20', '', ''],
      ['Clínica Sonrisa', 'Dr. Pérez', 'Ana Paciente', 'AC', '', '1', '', '2026-09-20', '', ''],
      ['Clínica Sonrisa', 'Dr. Pérez', 'Otro Paciente', 'ZR', '12', '1', '', '2026-09-21', '', ''],
    ])
    const r = await upload(recepcion, csv, true)
    expect(r.status).toBe(200)
    const report = (await r.json()) as { cases: number; errors: unknown[]; created: string[] }
    expect(report.cases).toBe(2)
    expect(report.errors).toEqual([])
    expect(report.created).toHaveLength(2)

    const rows = await ctx.db.query.cases.findMany({
      with: { items: { with: { product: true } } },
    })
    expect(rows).toHaveLength(2)
    const anaCase = rows.find((c) => c.patientRef === 'Ana Paciente')!
    expect(anaCase.items).toHaveLength(2)
    const zrItem = anaCase.items.find((i) => i.product.code === 'ZR')!
    expect(zrItem).toMatchObject({ unitPrice: '45.00', teeth: [11] })
    const acItem = anaCase.items.find((i) => i.product.code === 'AC')!
    expect(acItem).toMatchObject({ unitPrice: '80.00', teeth: [] })
    const otroCase = rows.find((c) => c.patientRef === 'Otro Paciente')!
    expect(otroCase.items).toHaveLength(1)
  })

  it('clínica desconocida: error con fila y columna, no crea nada aunque confirmar=true', async () => {
    const csv = csvOf([
      ['Clínica Fantasma', 'Dr. Pérez', 'Ana Paciente', 'ZR', '11', '1', '', '2026-09-20', '', ''],
    ])
    const r = await upload(recepcion, csv, true)
    expect(r.status).toBe(200)
    const report = (await r.json()) as {
      cases: number
      errors: { row: number; column: string; message: string }[]
      created: string[]
    }
    expect(report.errors).toEqual([
      { row: 2, column: 'clinica', message: 'La clínica "Clínica Fantasma" no existe' },
    ])
    expect(report.created).toEqual([])

    const rows = await ctx.db.select().from(ctx.schema.cases)
    expect(rows).toHaveLength(0)
  })

  it('cantidad mayor a 99: error en la columna cantidad, sin crear nada (nunca 500)', async () => {
    const csv = csvOf([
      ['Clínica Sonrisa', 'Dr. Pérez', 'Ana Paciente', 'ZR', '11', '100', '', '', '', ''],
    ])
    const r = await upload(recepcion, csv, true)
    expect(r.status).toBe(200)
    const report = (await r.json()) as {
      errors: { row: number; column: string; message: string }[]
      created: string[]
    }
    expect(report.errors).toEqual([
      { row: 2, column: 'cantidad', message: 'La cantidad máxima es 99' },
    ])
    expect(report.created).toEqual([])
  })

  it('paciente de más de 120 caracteres: error, sin crear nada (nunca 500)', async () => {
    const csv = csvOf([
      ['Clínica Sonrisa', 'Dr. Pérez', 'A'.repeat(130), 'ZR', '11', '1', '', '', '', ''],
    ])
    const r = await upload(recepcion, csv, true)
    expect(r.status).toBe(200)
    const report = (await r.json()) as {
      errors: { row: number; column: string; message: string }[]
      created: string[]
    }
    expect(report.errors).toEqual([
      { row: 2, column: 'paciente', message: 'Máximo 120 caracteres' },
    ])
    expect(report.created).toEqual([])
  })

  it('dos clínicas con el mismo nombre normalizado: error de ambigüedad, no crea nada', async () => {
    await ctx.db.insert(ctx.schema.clinics).values({ name: 'CLINICA SONRISA' })
    const csv = csvOf([
      ['Clínica Sonrisa', 'Dr. Pérez', 'Ana Paciente', 'ZR', '11', '1', '', '2026-09-20', '', ''],
    ])
    const r = await upload(recepcion, csv, true)
    expect(r.status).toBe(200)
    const report = (await r.json()) as {
      errors: { row: number; column: string; message: string }[]
      created: string[]
    }
    expect(report.errors).toEqual([
      {
        row: 2,
        column: 'clinica',
        message: 'La clínica "Clínica Sonrisa" es ambigua: hay 2 clínicas con ese nombre',
      },
    ])
    expect(report.created).toEqual([])

    const rows = await ctx.db.select().from(ctx.schema.cases)
    expect(rows).toHaveLength(0)
  })

  it('la plantilla lleva BOM UTF-8 y se puede volver a subir sin error de cabecera', async () => {
    const plantilla = await app.request('/api/trabajos/importar/plantilla', {
      headers: { cookie: recepcion, origin: ctx.config.WEB_ORIGIN },
    })
    const buf = new Uint8Array(await plantilla.arrayBuffer())
    expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])

    const text = new TextDecoder('utf-8').decode(buf)
    const r = await upload(recepcion, text, false)
    expect(r.status).toBe(200)
    const report = (await r.json()) as { errors: unknown[] }
    // La fila de ejemplo referencia una clínica/doctor/producto que no existen en esta
    // prueba: se espera que falle por eso, nunca por la cabecera.
    expect(report.errors).not.toContainEqual(expect.objectContaining({ column: 'cabecera' }))
  })

  it('técnico no puede importar (403)', async () => {
    const csv = csvOf([])
    expect((await upload(tecnico, csv, false)).status).toBe(403)
    expect(
      (
        await app.request('/api/trabajos/importar/plantilla', {
          headers: { cookie: tecnico, origin: ctx.config.WEB_ORIGIN },
        })
      ).status,
    ).toBe(403)
  })

  it('sin sesión: 403', async () => {
    const csv = csvOf([])
    expect((await upload('', csv, false)).status).toBe(403)
  })
})
