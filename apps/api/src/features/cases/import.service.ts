import type { CaseInput, ImportError, ImportReport, ImportRow } from '@dentalware/shared'
import {
  caseInputSchema,
  IMPORT_COLUMNS,
  importRowSchema,
  sortImportErrors,
  toCsv,
} from '@dentalware/shared'
import { z } from 'zod'
import type { Clock } from '../../lib/clock.ts'
import type { RequestContext } from '../../lib/request-context.ts'
import type { ImportCatalog } from './import.ports.ts'
import type { UnitOfWork } from './ports.ts'

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024 // 2 MB

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

const UTF8_BOM = '﻿'

/**
 * Cabecera de la plantilla + una fila de ejemplo, lista para descargar como CSV.
 * Lleva BOM UTF-8 al inicio para que Excel (Windows) detecte la codificación y no
 * rompa los acentos; `parseCsv` ya lo tolera al volver a subir el archivo.
 */
export function buildTemplateCsv(): string {
  return UTF8_BOM + toCsv([[...IMPORT_COLUMNS], EXAMPLE_ROW])
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

type RunOptions = { rows: string[][]; commit: boolean }
type RowState = { rowNumber: number; raw: Record<string, string>; parsed?: Row }

export function createImportService(deps: {
  catalog: ImportCatalog
  uow: UnitOfWork
  clock: Clock
}) {
  return {
    /**
     * Valida y opcionalmente crea los trabajos descritos por `rows` (filas de datos, sin
     * la cabecera; la fila 1 del archivo original es la cabecera, así que la primera fila
     * de datos es la 2). Agrupa filas consecutivas con la misma (clínica, doctor,
     * paciente, fecha deseada, caja) en un solo trabajo. Con cualquier error no crea nada.
     */
    async run(opts: RunOptions, ctx: RequestContext): Promise<ImportReport> {
      const { rows, commit } = opts
      const totalRows = rows.length
      const errors: ImportError[] = []
      // Un solo valor de reloj para todo el archivo: si la importación cruza la medianoche,
      // todos los trabajos del mismo archivo comparten `receivedAt` (y con él, el año del
      // código de trabajo que deriva `repo.ts` de esa fecha).
      const today = deps.clock.today()

      // Primera pasada: valida el formato de cada fila de forma independiente. Una fila
      // con un error de formato (p. ej. fecha_deseada inválida) no se descarta: se
      // conserva su `raw` para intentar resolver clínica/doctor/producto más abajo, así
      // el usuario ve en una sola vuelta tanto el error de formato como el de resolución.
      const rowStates: RowState[] = rows.map((cols, idx) => {
        const rowNumber = idx + 2
        const obj: Record<string, string> = {}
        IMPORT_COLUMNS.forEach((col, i) => {
          obj[col] = cols[i] ?? ''
        })
        const result = importRowSchema.safeParse(obj)
        if (!result.success) {
          for (const issue of result.error.issues) {
            errors.push({
              row: rowNumber,
              column: String(issue.path[0] ?? ''),
              message: issue.message,
            })
          }
          return { rowNumber, raw: obj }
        }
        return { rowNumber, raw: obj, parsed: { ...result.data, rowNumber } }
      })

      const parsed = rowStates.flatMap((s) => (s.parsed ? [s.parsed] : []))
      const groups = groupRows(parsed)

      const allClinics = await deps.catalog.clinics()
      const allDoctors = await deps.catalog.doctors()
      const allProducts = await deps.catalog.products()

      // "found" con más de un elemento significa nombre ambiguo (varias filas de la BD
      // normalizan igual): se reporta como error en vez de tomar la primera al azar.
      type Resolved<T> =
        { kind: 'not-found' } | { kind: 'ambiguous'; count: number } | { kind: 'found'; value: T }
      function resolve<T>(matches: T[]): Resolved<T> {
        if (matches.length === 0) return { kind: 'not-found' }
        if (matches.length > 1) return { kind: 'ambiguous', count: matches.length }
        return { kind: 'found', value: matches[0]! }
      }

      const findClinic = (name: string) => {
        const n = normalizeName(name)
        return resolve(allClinics.filter((c) => c.active && normalizeName(c.name) === n))
      }
      const findDoctor = (clinicId: string, name: string) => {
        const n = normalizeName(name)
        return resolve(
          allDoctors.filter(
            (d) => d.active && d.clinicId === clinicId && normalizeName(d.name) === n,
          ),
        )
      }
      // El código de producto es único en la BD (`products.code` unique), así que una
      // coincidencia exacta de código nunca es ambigua y se usa aunque el nombre de otro
      // producto coincida por casualidad; solo se cae a la búsqueda por nombre (que sí
      // puede ser ambigua) cuando no hay coincidencia por código.
      const findProduct = (codeOrName: string) => {
        const n = normalizeName(codeOrName)
        const byCode = resolve(allProducts.filter((p) => p.active && normalizeName(p.code) === n))
        if (byCode.kind !== 'not-found') return byCode
        return resolve(allProducts.filter((p) => p.active && normalizeName(p.name) === n))
      }

      // Filas con error de formato: no forman parte de ningún grupo (no se puede agrupar
      // con seguridad sin sus datos parseados), pero igual se intenta resolver clínica,
      // doctor y producto usando los valores crudos de las columnas que sí son válidas
      // (no vacías) en esa misma fila. Así el informe trae, en una sola pasada, tanto el
      // error de formato como cualquier error de resolución de la misma fila.
      for (const state of rowStates) {
        if (state.parsed) continue
        const clinicaRaw = (state.raw['clinica'] ?? '').trim()
        const doctorRaw = (state.raw['doctor'] ?? '').trim()
        const productoRaw = (state.raw['producto'] ?? '').trim()

        if (clinicaRaw) {
          const clinic = findClinic(clinicaRaw)
          if (clinic.kind === 'not-found') {
            errors.push({
              row: state.rowNumber,
              column: 'clinica',
              message: `La clínica "${clinicaRaw}" no existe`,
            })
          } else if (clinic.kind === 'ambiguous') {
            errors.push({
              row: state.rowNumber,
              column: 'clinica',
              message: `La clínica "${clinicaRaw}" es ambigua: hay ${clinic.count} clínicas con ese nombre`,
            })
          } else if (doctorRaw) {
            const doctor = findDoctor(clinic.value.id, doctorRaw)
            if (doctor.kind === 'not-found') {
              errors.push({
                row: state.rowNumber,
                column: 'doctor',
                message: `El doctor "${doctorRaw}" no existe en la clínica "${clinic.value.name}"`,
              })
            } else if (doctor.kind === 'ambiguous') {
              errors.push({
                row: state.rowNumber,
                column: 'doctor',
                message: `El doctor "${doctorRaw}" es ambiguo: hay ${doctor.count} doctores con ese nombre en la clínica "${clinic.value.name}"`,
              })
            }
          }
        }

        if (productoRaw) {
          const product = findProduct(productoRaw)
          if (product.kind === 'not-found') {
            errors.push({
              row: state.rowNumber,
              column: 'producto',
              message: `El producto "${productoRaw}" no existe`,
            })
          } else if (product.kind === 'ambiguous') {
            errors.push({
              row: state.rowNumber,
              column: 'producto',
              message: `El producto "${productoRaw}" es ambiguo: hay ${product.count} productos con ese nombre`,
            })
          }
        }
      }

      const inputs: CaseInput[] = []
      for (const group of groups) {
        const first = group[0]!
        const clinic = findClinic(first.clinica)
        if (clinic.kind === 'not-found') {
          errors.push({
            row: first.rowNumber,
            column: 'clinica',
            message: `La clínica "${first.clinica}" no existe`,
          })
          continue
        }
        if (clinic.kind === 'ambiguous') {
          errors.push({
            row: first.rowNumber,
            column: 'clinica',
            message: `La clínica "${first.clinica}" es ambigua: hay ${clinic.count} clínicas con ese nombre`,
          })
          continue
        }
        const doctor = findDoctor(clinic.value.id, first.doctor)
        if (doctor.kind === 'not-found') {
          errors.push({
            row: first.rowNumber,
            column: 'doctor',
            message: `El doctor "${first.doctor}" no existe en la clínica "${clinic.value.name}"`,
          })
          continue
        }
        if (doctor.kind === 'ambiguous') {
          errors.push({
            row: first.rowNumber,
            column: 'doctor',
            message: `El doctor "${first.doctor}" es ambiguo: hay ${doctor.count} doctores con ese nombre en la clínica "${clinic.value.name}"`,
          })
          continue
        }
        const items: CaseInput['items'] = []
        for (const row of group) {
          const product = findProduct(row.producto)
          if (product.kind === 'not-found') {
            errors.push({
              row: row.rowNumber,
              column: 'producto',
              message: `El producto "${row.producto}" no existe`,
            })
            continue
          }
          if (product.kind === 'ambiguous') {
            errors.push({
              row: row.rowNumber,
              column: 'producto',
              message: `El producto "${row.producto}" es ambiguo: hay ${product.count} productos con ese nombre`,
            })
            continue
          }
          items.push({
            productId: product.value.id,
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
        // Defensa en profundidad: importRowSchema/priceItems ya validan lo mismo que
        // caseInputSchema, pero si algún límite se desalinea en el futuro esto evita un 500
        // y lo reporta como una fila más del informe.
        try {
          inputs.push(
            caseInputSchema.parse({
              clinicId: clinic.value.id,
              doctorId: doctor.value.id,
              patientRef: first.paciente,
              receivedAt: today,
              dueDate: first.fecha_deseada,
              boxNumber: first.caja,
              shade: first.color,
              observations: first.observaciones,
              items,
            }),
          )
        } catch (e) {
          if (!(e instanceof z.ZodError)) throw e
          for (const issue of e.issues) {
            errors.push({
              row: first.rowNumber,
              column: String(issue.path[0] ?? 'fila'),
              message: issue.message,
            })
          }
        }
      }

      if (errors.length > 0) {
        return { totalRows, cases: 0, errors: sortImportErrors(errors), created: [] }
      }

      if (!commit) return { totalRows, cases: inputs.length, errors: [], created: [] }

      const created: string[] = []
      await deps.uow.run(async ({ cases }) => {
        for (const input of inputs) {
          const { code } = await cases.create(input, ctx.userId)
          created.push(code)
        }
      })
      return { totalRows, cases: inputs.length, errors: [], created }
    },
  }
}
export type ImportService = ReturnType<typeof createImportService>
