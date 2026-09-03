import { z } from 'zod'

const Q1 = [18, 17, 16, 15, 14, 13, 12, 11] as const
const Q2 = [21, 22, 23, 24, 25, 26, 27, 28] as const
const Q4 = [48, 47, 46, 45, 44, 43, 42, 41] as const
const Q3 = [31, 32, 33, 34, 35, 36, 37, 38] as const

/** Orden de lectura del odontograma: arcada superior (18→28) y luego inferior (48→38). */
export const FDI_TEETH = [...Q1, ...Q2, ...Q4, ...Q3] as const
export type FdiTooth = (typeof FDI_TEETH)[number]

export const FDI_QUADRANTS = { 1: Q1, 2: Q2, 3: Q3, 4: Q4 } as const

const FDI_SET: ReadonlySet<number> = new Set(FDI_TEETH)

export function isFdiTooth(n: unknown): n is FdiTooth {
  return typeof n === 'number' && FDI_SET.has(n)
}

const POSITION_NAMES = [
  'Incisivo central',
  'Incisivo lateral',
  'Canino',
  'Primer premolar',
  'Segundo premolar',
  'Primer molar',
  'Segundo molar',
  'Tercer molar',
] as const

export function toothLabel(n: FdiTooth): string {
  const quadrant = Math.floor(n / 10)
  const position = (n % 10) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  const arch = quadrant <= 2 ? 'superior' : 'inferior'
  const side = quadrant === 1 || quadrant === 4 ? 'derecho' : 'izquierdo'
  return `${n} · ${POSITION_NAMES[position - 1]} ${arch} ${side}`
}

export const fdiToothSchema = z
  .number()
  .int()
  .refine(isFdiTooth, { error: 'Pieza dental FDI inválida' })

export const fdiTeethSchema = z
  .array(fdiToothSchema)
  .refine((arr) => new Set(arr).size === arr.length, { error: 'Piezas repetidas' })
  .transform((arr) => [...arr].sort((a, b) => a - b))
