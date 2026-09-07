import type { CaseInput, ImportRow } from '@dentalware/shared'
import {
  caseInputSchema,
  IMPORT_COLUMNS,
  importRowSchema,
  parseCsv,
  toCsv,
  toIsoDate,
} from '@dentalware/shared'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { Db } from '../../db/index.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireRole } from '../auth/session.ts'
import { clinics } from '../clinics/schema.ts'
import { doctors } from '../doctors/schema.ts'
import { products } from '../products/schema.ts'
import { createCaseTx } from './repo.ts'

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024 // 2 MB

export type ImportError = { row: number; column: string; message: string }
export type ImportReport = {
  totalRows: number
  cases: number
  errors: ImportError[]
  created: string[]
}

const EXAMPLE_ROW = [
  'Clínica Sonrisa',
  'Dr. Pérez',
  'Ana Paciente',
  'ZR',
  '11,12',
  '1',
  'A2',
  '15/09/2026',
  'C-001',
  'Urgente',
]

/** Cabecera de la plantilla + una fila de ejemplo, lista para descargar como CSV. */
export function buildTemplateCsv(): string {
  return toCsv([[...IMPORT_COLUMNS], EXAMPLE_ROW])
}

/** Insensible a mayúsculas y acentos; colapsa espacios. Para comparar nombres. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/** La cabecera del CSV subido debe coincidir exactamente (insensible a mayúsculas) con `IMPORT_COLUMNS`. */
export function headerMatches(header: string[]): boolean {
  if (header.length !== IMPORT_COLUMNS.length) return false
  return IMPORT_COLUMNS.every((col, i) => header[i]?.trim().toLowerCase() === col)
}

type Row = ImportRow & { rowNumber: number }

function sameGroup(a: Row, b: Row): boolean {
  return (
    normalizeName(a.clinica) === normalizeName(b.clinica) &&
    normalizeName(a.doctor) === normalizeName(b.doctor) &&
    normalizeName(a.paciente) === normalizeName(b.paciente) &&
    (a.fecha_deseada ?? '') === (b.fecha_deseada ?? '') &&
    normalizeName(a.caja ?? '') === normalizeName(b.caja ?? '')
  )
}

function groupRows(rows: Row[]): Row[][] {
  const groups: Row[][] = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (last && sameGroup(last[0]!, row)) last.push(row)
    else groups.push([row])
  }
  return groups
}

type Options = { rows: string[][]; actorId: string; today: string; commit: boolean }

/**
 * Valida y opcionalmente crea los trabajos descritos por `rows` (filas de datos, sin la
 * cabecera; la fila 1 del archivo original es la cabecera, así que la primera fila de
 * datos es la 2). Agrupa filas consecutivas con la misma (clínica, doctor, paciente,
 * fecha deseada, caja) en un solo trabajo. Con cualquier error no crea nada.
 */
export async function importCases(db: Db, opts: Options): Promise<ImportReport> {
  const { rows, actorId, today, commit } = opts
  const totalRows = rows.length
  const errors: ImportError[] = []
  const parsed: Row[] = []

  rows.forEach((cols, idx) => {
    const rowNumber = idx + 2
    const obj: Record<string, string> = {}
    IMPORT_COLUMNS.forEach((col, i) => {
      obj[col] = cols[i] ?? ''
    })
    const result = importRowSchema.safeParse(obj)
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ row: rowNumber, column: String(issue.path[0] ?? ''), message: issue.message })
      }
      return
    }
    parsed.push({ ...result.data, rowNumber })
  })

  if (errors.length > 0) return { totalRows, cases: 0, errors, created: [] }

  const groups = groupRows(parsed)

  const allClinics = await db
    .select({ id: clinics.id, name: clinics.name, active: clinics.active })
    .from(clinics)
  const allDoctors = await db
    .select({
      id: doctors.id,
      name: doctors.name,
      clinicId: doctors.clinicId,
      active: doctors.active,
    })
    .from(doctors)
  const allProducts = await db
    .select({ id: products.id, code: products.code, name: products.name, active: products.active })
    .from(products)

  const findClinic = (name: string) => {
    const n = normalizeName(name)
    return allClinics.find((c) => c.active && normalizeName(c.name) === n)
  }
  const findDoctor = (clinicId: string, name: string) => {
    const n = normalizeName(name)
    return allDoctors.find(
      (d) => d.active && d.clinicId === clinicId && normalizeName(d.name) === n,
    )
  }
  const findProduct = (codeOrName: string) => {
    const n = normalizeName(codeOrName)
    return allProducts.find(
      (p) => p.active && (normalizeName(p.code) === n || normalizeName(p.name) === n),
    )
  }

  const inputs: CaseInput[] = []
  for (const group of groups) {
    const first = group[0]!
    const clinic = findClinic(first.clinica)
    if (!clinic) {
      errors.push({
        row: first.rowNumber,
        column: 'clinica',
        message: `La clínica "${first.clinica}" no existe`,
      })
      continue
    }
    const doctor = findDoctor(clinic.id, first.doctor)
    if (!doctor) {
      errors.push({
        row: first.rowNumber,
        column: 'doctor',
        message: `El doctor "${first.doctor}" no existe en la clínica "${clinic.name}"`,
      })
      continue
    }
    const items: CaseInput['items'] = []
    for (const row of group) {
      const product = findProduct(row.producto)
      if (!product) {
        errors.push({
          row: row.rowNumber,
          column: 'producto',
          message: `El producto "${row.producto}" no existe`,
        })
        continue
      }
      items.push({
        productId: product.id,
        quantity: row.cantidad,
        teeth: row.piezas,
        unitPrice: null,
        discountPct: 0,
        description: null,
        material: null,
        notes: null,
      })
    }
    if (items.length === 0) continue
    inputs.push(
      caseInputSchema.parse({
        clinicId: clinic.id,
        doctorId: doctor.id,
        patientRef: first.paciente,
        receivedAt: today,
        dueDate: first.fecha_deseada,
        boxNumber: first.caja,
        shade: first.color,
        observations: first.observaciones,
        items,
      }),
    )
  }

  if (errors.length > 0) return { totalRows, cases: 0, errors, created: [] }

  if (!commit) return { totalRows, cases: inputs.length, errors: [], created: [] }

  const created: string[] = []
  await db.transaction(async (tx) => {
    for (const input of inputs) {
      const { code } = await createCaseTx(tx, input, actorId)
      created.push(code)
    }
  })
  return { totalRows, cases: inputs.length, errors: [], created }
}

export const importRoutes = (db: Db) =>
  new Hono<AppEnv>()
    .use(requireRole('admin', 'recepcion'))
    .get('/plantilla', (c) => {
      c.header('Content-Type', 'text/csv; charset=utf-8')
      c.header('Content-Disposition', 'attachment; filename="plantilla-trabajos.csv"')
      return c.body(buildTemplateCsv())
    })
    .post(
      '/',
      bodyLimit({
        maxSize: MAX_IMPORT_BYTES + 1024,
        onError: (c) => c.json({ message: 'El archivo supera los 2 MB' }, 413),
      }),
      async (c) => {
        const commit = c.req.query('confirmar') === 'true'
        const body = await c.req.parseBody()
        const file = body['file']
        if (!(file instanceof File)) {
          return c.json(
            {
              message: 'Datos inválidos',
              issues: [{ path: 'file', message: 'Adjunta un archivo CSV' }],
            },
            422,
          )
        }
        if (file.size > MAX_IMPORT_BYTES) {
          return c.json({ message: 'El archivo supera los 2 MB' }, 413)
        }
        const text = await file.text()
        const rows = parseCsv(text)
        if (rows.length === 0 || !headerMatches(rows[0]!)) {
          return c.json(
            {
              message: 'Datos inválidos',
              issues: [{ path: 'cabecera', message: 'La cabecera no coincide con la plantilla' }],
            },
            422,
          )
        }
        const report = await importCases(db, {
          rows: rows.slice(1),
          actorId: c.var.user!.id,
          today: toIsoDate(new Date()),
          commit,
        })
        return c.json(report, 200)
      },
    )
