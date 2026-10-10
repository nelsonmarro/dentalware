import { z } from 'zod'
import { ADJUSTMENT_SIGNS, PAYMENT_METHODS } from '../accounts.ts'
import { fromCents, parseMoneyInput } from '../money.ts'
import {
  MONTO_FORMAT,
  montoPositivo,
  motivoObligatorio,
  type AdjustmentInput,
  type ApplyCreditInput,
  type PaymentInput,
} from './accounts.ts'
import { isoDate, textoOpcional, uuid } from './config.ts'

/**
 * Formularios de cuentas en la web (CTA-2/3). Validan lo que se escribe y lo convierten en el
 * cuerpo que espera la API (`paymentInputSchema`, `applyCreditInputSchema`,
 * `adjustmentInputSchema`), con los mismos mensajes. Aceptan coma decimal (`parseMoneyInput`).
 *
 * El reparto es una fila por trabajo «Por cobrar», con el monto vacío si no se le asigna nada:
 * los errores van en la fila que el usuario ve (`asignaciones.N.monto`) y las vacías se quitan
 * al salir.
 */

/** Un monto escrito: sin espacios y con punto decimal. */
const normalizeMoney = (v: string) => v.trim().replace(',', '.')

/** Monto de un campo obligatorio, con coma o punto. */
const montoEscrito = z.string().transform(normalizeMoney).pipe(montoPositivo)

/** Monto de una fila del reparto: vacío (no se asigna) o un monto mayor que 0. */
const montoFila = z
  .string()
  .transform(normalizeMoney)
  .refine((v) => v === '' || parseMoneyInput(v) !== null, { error: MONTO_FORMAT })
  .refine((v) => v === '' || parseMoneyInput(v) !== 0, { error: 'El monto debe ser mayor que 0' })

const filaReparto = z.object({ trabajoId: uuid, monto: montoFila })
type FilaReparto = z.output<typeof filaReparto>

/** Las filas con monto, que son las que viajan a la API. */
const filled = (rows: readonly FilaReparto[]) => rows.filter((r) => r.monto !== '')

/** Σ de las filas con monto, en centavos. */
const assignedCents = (rows: readonly FilaReparto[]) =>
  filled(rows).reduce((sum, r) => sum + (parseMoneyInput(r.monto) ?? 0), 0)

/** «Registrar pago»: el pago y su reparto, que puede quedarse corto (el resto queda a favor). */
export const paymentFormSchema = z
  .object({
    clinicaId: uuid,
    monto: montoEscrito,
    metodo: z.enum(PAYMENT_METHODS, { error: 'Elige un método de pago' }),
    fecha: isoDate,
    referencia: textoOpcional(100),
    notas: textoOpcional(500),
    asignaciones: z.array(filaReparto),
  })
  // Con `when`, se compara aunque otro campo (el método) haya fallado, para que el formulario
  // diga todo de una vez; pero solo si hay un monto del pago válido con el que comparar.
  .refine((v) => assignedCents(v.asignaciones) <= (parseMoneyInput(v.monto) ?? 0), {
    path: ['asignaciones'],
    message: 'Lo asignado no puede superar el monto del pago',
    when: ({ value }) => {
      const v = value as { monto?: unknown; asignaciones?: unknown }
      return (
        typeof v.monto === 'string' &&
        parseMoneyInput(v.monto) !== null &&
        Array.isArray(v.asignaciones)
      )
    },
  })
  .transform((v): PaymentInput => ({ ...v, asignaciones: filled(v.asignaciones) }))

/** «Aplicar saldo a favor» de un pago: al menos un trabajo y, en total, no más de lo que le
 * queda al pago (`availableCents`). */
export function applyCreditFormSchema(availableCents: number) {
  return z
    .object({ asignaciones: z.array(filaReparto) })
    .superRefine((v, ctx) => {
      if (filled(v.asignaciones).length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['asignaciones'],
          message: 'Asigna un monto a al menos un trabajo',
        })
      } else if (assignedCents(v.asignaciones) > availableCents) {
        ctx.addIssue({
          code: 'custom',
          path: ['asignaciones'],
          message: `Lo asignado no puede superar lo que queda a favor ($${fromCents(availableCents)})`,
        })
      }
    })
    .transform((v): ApplyCreditInput => ({ asignaciones: filled(v.asignaciones) }))
}

/** «Registrar ajuste»: el signo se elige aparte y el monto se escribe en positivo; un trabajo
 * vacío es un ajuste solo de la clínica (p. ej. «Saldo inicial»). */
export const adjustmentFormSchema = z
  .object({
    clinicaId: uuid,
    signo: z.enum(ADJUSTMENT_SIGNS, { error: 'Elige si es un descuento o un recargo' }),
    monto: montoEscrito,
    motivo: motivoObligatorio,
    fecha: isoDate,
    trabajoId: z
      .string()
      .transform((v) => (v === '' ? null : v))
      .pipe(uuid.nullable()),
  })
  .transform((v): AdjustmentInput => ({
    clinicaId: v.clinicaId,
    trabajoId: v.trabajoId,
    monto: v.signo === 'descuento' ? `-${v.monto}` : v.monto,
    motivo: v.motivo,
    fecha: v.fecha,
  }))
