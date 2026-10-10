import { z } from 'zod'
import { PAYMENT_METHODS } from '../accounts.ts'
import { toCents } from '../money.ts'
import { isoDate, textoOpcional, uuid } from './config.ts'

/**
 * Contratos de cuentas y cobro (Iteración 5, CTA-1/2/3/5). Los montos viajan como cadena
 * decimal `"12.34"` (`money.ts`): hasta 10 enteros (`numeric(12,2)`) y 2 decimales.
 */

export const MONTO_FORMAT = 'El monto debe ser un número con hasta 2 decimales'
const POSITIVE_MONEY = /^\d{1,10}(\.\d{1,2})?$/
const SIGNED_MONEY = /^-?\d{1,10}(\.\d{1,2})?$/

/** Centavos de un monto sin signo ya validado por formato; `null` si no lo cumple (el error de
 * formato lo da la regex, y así ninguna regla de suma lanza con un valor inválido). */
function centsOf(monto: string): number | null {
  return POSITIVE_MONEY.test(monto) ? toCents(monto) : null
}

/** Monto de un pago o de una asignación: mayor que 0 y sin signo. */
export const montoPositivo = z
  .string()
  .trim()
  .regex(POSITIVE_MONEY, { error: MONTO_FORMAT })
  .refine((m) => centsOf(m) !== 0, { error: 'El monto debe ser mayor que 0' })

/** Monto de un ajuste: con signo (descuento negativo, recargo positivo), nunca 0. */
const montoConSigno = z
  .string()
  .trim()
  .regex(SIGNED_MONEY, { error: MONTO_FORMAT })
  .refine((m) => centsOf(m.replace(/^-/, '')) !== 0, { error: 'El monto no puede ser 0' })

export const motivoObligatorio = z
  .string()
  .trim()
  .min(1, { error: 'Escribe el motivo' })
  .max(500, { error: 'Máximo 500 caracteres' })

const asignacionSchema = z.object({ trabajoId: uuid, monto: montoPositivo })
export type AllocationInput = z.infer<typeof asignacionSchema>

/** Un trabajo aparece una sola vez en un reparto: el error va en su segunda aparición. */
function rejectRepeatedCases(asignaciones: readonly AllocationInput[], ctx: z.RefinementCtx) {
  const seen = new Set<string>()
  asignaciones.forEach((a, i) => {
    if (seen.has(a.trabajoId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['asignaciones', i, 'trabajoId'],
        message: 'Este trabajo ya está en el reparto',
      })
    }
    seen.add(a.trabajoId)
  })
}

/** `POST /api/cuentas/pagos` (CTA-2): el pago y su reparto entre trabajos entregados. Puede
 * asignar menos que su monto (anticipo o pago de más: el resto queda a favor, decisión 3), nunca
 * más. Que cada asignación no pase del pendiente de su trabajo lo valida la API. */
export const paymentInputSchema = z
  .object({
    clinicaId: uuid,
    monto: montoPositivo,
    metodo: z.enum(PAYMENT_METHODS, { error: 'Elige un método de pago' }),
    fecha: isoDate,
    referencia: textoOpcional(100),
    notas: textoOpcional(500),
    asignaciones: z.array(asignacionSchema),
  })
  .superRefine((v, ctx) => {
    rejectRepeatedCases(v.asignaciones, ctx)
    const total = centsOf(v.monto)
    const cents = v.asignaciones.map((a) => centsOf(a.monto))
    if (total === null || cents.some((c) => c === null)) return
    const assigned = cents.reduce<number>((sum, c) => sum + (c ?? 0), 0)
    if (assigned > total) {
      ctx.addIssue({
        code: 'custom',
        path: ['asignaciones'],
        message: 'Lo aplicado no puede superar el monto del pago',
      })
    }
  })
export type PaymentInput = z.infer<typeof paymentInputSchema>

/** `POST /api/cuentas/pagos/:id/asignaciones` (decisión 3): reparte lo no asignado de un pago.
 * Que no pase de lo que queda del pago lo valida la API, que lo conoce. */
export const applyCreditInputSchema = z
  .object({
    asignaciones: z.array(asignacionSchema).min(1, { error: 'Elige al menos un trabajo' }),
  })
  .superRefine((v, ctx) => rejectRepeatedCases(v.asignaciones, ctx))
export type ApplyCreditInput = z.infer<typeof applyCreditInputSchema>

/** `POST /api/cuentas/pagos/:id/anular` (decisión 2): solo admin, con motivo. */
export const voidPaymentInputSchema = z.object({ motivo: motivoObligatorio })
export type VoidPaymentInput = z.infer<typeof voidPaymentInputSchema>

/** `POST /api/cuentas/ajustes` (CTA-3): descuento (negativo) o recargo (positivo), ligado a un
 * trabajo o solo a la clínica (p. ej. «Saldo inicial»). Un trabajo vacío llega del formulario
 * como `''` y cuenta como sin trabajo. */
export const adjustmentInputSchema = z.object({
  clinicaId: uuid,
  trabajoId: z.preprocess(
    (v) => (v === '' ? null : v),
    uuid.nullish().transform((v) => v ?? null),
  ),
  monto: montoConSigno,
  motivo: motivoObligatorio,
  fecha: isoDate,
})
export type AdjustmentInput = z.infer<typeof adjustmentInputSchema>

/** El estado de cuenta llega hasta hoy (I-2): con una fecha final futura, la antigüedad y los
 * días de «Por cobrar» saldrían proyectados. Lo comprueban el servicio (con su reloj, 422 en
 * `hasta`) y el formulario del periodo (`statementRangeFormSchema`). */
export const STATEMENT_AFTER_TODAY_MESSAGE = 'La fecha final no puede ser posterior a hoy'

/** `GET /api/cuentas/:clinicaId/estado` (CTA-5): rango de fechas de negocio, `desde ≤ hasta`. */
export const accountStatementQuerySchema = z
  .object({ desde: isoDate, hasta: isoDate })
  .refine((v) => v.desde <= v.hasta, {
    path: ['hasta'],
    error: 'La fecha final no puede ser anterior a la inicial',
  })
export type AccountStatementQuery = z.infer<typeof accountStatementQuerySchema>

/** `GET /api/cuentas` (CTA-1): por omisión, solo las clínicas con saldo o con movimientos; con
 * `todas=1`, también las activas sin nada. */
export const accountListQuerySchema = z.object({
  todas: z
    .enum(['0', '1'], { error: 'Valor no válido' })
    .optional()
    .transform((v) => v === '1'),
})
export type AccountListQuery = z.infer<typeof accountListQuerySchema>
