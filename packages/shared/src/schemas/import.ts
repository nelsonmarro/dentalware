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

/** `''` → `null`; `AAAA-MM-DD` se acepta tal cual; `DD/MM/AAAA` se convierte a ISO. */
function parseFlexibleDate(v: string): string | null | undefined {
  const trimmed = v.trim()
  if (!trimmed) return null
  if (isoDate.safeParse(trimmed).success) return trimmed
  const m = DDMMYYYY.exec(trimmed)
  if (!m) return undefined // inválida
  const [, dd, mm, yyyy] = m
  return `${yyyy}-${mm}-${dd}`
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
    .default(1),
)

const textoRequerido = (campo: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `El campo "${campo}" es obligatorio` })

/** Valida una fila del CSV ya mapeada por cabecera (ver `IMPORT_COLUMNS`). */
export const importRowSchema = z.object({
  clinica: textoRequerido('clinica'),
  doctor: textoRequerido('doctor'),
  paciente: textoRequerido('paciente'),
  producto: textoRequerido('producto'),
  piezas: piezasSchema,
  cantidad: cantidadSchema,
  color: textoOpcional(30),
  fecha_deseada: fechaDeseadaSchema,
  caja: textoOpcional(30),
  observaciones: textoOpcional(2000),
})
export type ImportRow = z.infer<typeof importRowSchema>
