import { z } from 'zod'
import type { FdiTooth } from '../fdi.ts'
import { isFdiTooth } from '../fdi.ts'
import { isoDate } from './cases.ts'
import { textoOpcional } from './config.ts'

/** Cabecera exacta (en orden) de la plantilla CSV de importación de trabajos. */
export const IMPORT_COLUMNS = [
  'clinica',
  'doctor',
  'paciente',
  'producto',
  'piezas',
  'cantidad',
  'color',
  'fecha_deseada',
  'caja',
  'observaciones',
] as const
export type ImportColumn = (typeof IMPORT_COLUMNS)[number]

const DDMMYYYY = /^(\d{2})\/(\d{2})\/(\d{4})$/
const ISO_SHAPE = /^\d{4}-\d{2}-\d{2}$/

/** Solo arma la cadena ISO candidata; la validez real de calendario la decide `isoDate`. */
function toIsoCandidate(trimmed: string): string | null {
  if (ISO_SHAPE.test(trimmed)) return trimmed
  const m = DDMMYYYY.exec(trimmed)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  return `${yyyy}-${mm}-${dd}`
}

/**
 * `''` → `null`; `AAAA-MM-DD` o `DD/MM/AAAA` → ISO, validando que sea una fecha de
 * calendario real (reutiliza `isoDate`, que hace el chequeo de ida y vuelta con
 * `Date.UTC`) para rechazar `31/02/2026`, `2026-13-40` o `29/02/2025` (no bisiesto).
 */
function parseFlexibleDate(v: string): string | null | undefined {
  const trimmed = v.trim()
  if (!trimmed) return null
  const candidate = toIsoCandidate(trimmed)
  if (!candidate) return undefined // formato irreconocible
  return isoDate.safeParse(candidate).success ? candidate : undefined
}

const fechaDeseadaSchema = z
  .string()
  .default('')
  .transform((v, ctx) => {
    const parsed = parseFlexibleDate(v)
    if (parsed === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Fecha inválida (usa AAAA-MM-DD o DD/MM/AAAA)' })
      return z.NEVER
    }
    return parsed
  })

/** `"11,12,21"` → `[11, 12, 21]`; cadena vacía → `[]`. */
const piezasSchema = z
  .string()
  .default('')
  .transform((v, ctx) => {
    const trimmed = v.trim()
    if (!trimmed) return [] as FdiTooth[]
    const parts = trimmed.split(',').map((p) => p.trim())
    const nums: FdiTooth[] = []
    for (const p of parts) {
      const n = Number(p)
      if (!isFdiTooth(n)) {
        ctx.addIssue({ code: 'custom', message: 'Pieza dental FDI inválida' })
        return z.NEVER
      }
      nums.push(n)
    }
    if (new Set(nums).size !== nums.length) {
      ctx.addIssue({ code: 'custom', message: 'Piezas repetidas' })
      return z.NEVER
    }
    return [...nums].sort((a, b) => a - b)
  })

const cantidadSchema = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.coerce
    .number({ error: 'Cantidad inválida' })
    .int({ error: 'Cantidad inválida' })
    .min(1, { error: 'La cantidad mínima es 1' })
    .max(99, { error: 'La cantidad máxima es 99' })
    .default(1),
)

// Mismos mensajes que caseItemSchema/caseInputSchema en `cases.ts` (patientRef reusa
// literalmente "La referencia del paciente es obligatoria"): la importación crea el
// mismo `CaseInput`, así que sus errores deben leerse igual en ambos flujos.
const clinicaSchema = z.string().trim().min(1, { error: 'La clínica es obligatoria' })
const doctorSchema = z.string().trim().min(1, { error: 'El doctor es obligatorio' })
const pacienteSchema = z
  .string()
  .trim()
  .min(1, { error: 'La referencia del paciente es obligatoria' })
  .max(120, { error: 'Máximo 120 caracteres' })
const productoSchema = z.string().trim().min(1, { error: 'El producto es obligatorio' })

/** Valida una fila del CSV ya mapeada por cabecera (ver `IMPORT_COLUMNS`). */
export const importRowSchema = z.object({
  clinica: clinicaSchema,
  doctor: doctorSchema,
  paciente: pacienteSchema,
  producto: productoSchema,
  piezas: piezasSchema,
  cantidad: cantidadSchema,
  color: textoOpcional(30),
  fecha_deseada: fechaDeseadaSchema,
  caja: textoOpcional(30),
  observaciones: textoOpcional(2000),
})
export type ImportRow = z.infer<typeof importRowSchema>

/** Un error de validación o de resolución de catálogo en una fila del CSV importado. */
export type ImportError = { row: number; column: string; message: string }

/** Resultado de validar (o confirmar) una importación: ver `importCases` en la API. */
export type ImportReport = {
  totalRows: number
  cases: number
  errors: ImportError[]
  created: string[]
}

/**
 * Posición de una columna dentro de `IMPORT_COLUMNS`; una columna que no aparece ahí
 * (por ejemplo un nombre de campo de `CaseInput` usado como último recurso) va al final.
 */
function columnOrder(column: string): number {
  const idx = (IMPORT_COLUMNS as readonly string[]).indexOf(column)
  return idx === -1 ? IMPORT_COLUMNS.length : idx
}

/**
 * Ordena los errores de una importación por fila y, dentro de la misma fila, por
 * columna según el orden de `IMPORT_COLUMNS`. Permite combinar en una sola lista los
 * errores de formato de una fila con sus errores de resolución de catálogo (clínica,
 * doctor, producto) y mostrarlos siempre en el mismo orden predecible.
 */
export function sortImportErrors(errors: ImportError[]): ImportError[] {
  return [...errors].sort((a, b) => a.row - b.row || columnOrder(a.column) - columnOrder(b.column))
}
