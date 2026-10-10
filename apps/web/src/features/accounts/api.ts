import type {
  AccountStatementQuery,
  AdjustmentInput,
  ApplyCreditInput,
  PaymentInput,
  VoidPaymentInput,
} from '@dentalware/shared'
import { api } from '@/lib/api'
import { throwIfNotOk } from '@/lib/api-error'

const cuentas = api.api.cuentas

/** `GET /api/cuentas` (CTA-1): cada clínica con su saldo (con signo: negativo es saldo a
 * favor), su antigüedad por cubo y los días de lo más antiguo que debe, de mayor a menor saldo.
 * Por omisión, solo las clínicas con saldo o movimientos; con `todas`, también las activas sin
 * nada. Solo admin y recepción (`ACCOUNTS_ROLES`). */
export async function fetchAccounts({ todas }: { todas: boolean }) {
  const query = todas ? { todas: '1' as const } : {}
  return (await (await throwIfNotOk(await cuentas.$get({ query }))).json()).clinics
}
export type AccountRow = Awaited<ReturnType<typeof fetchAccounts>>[number]

/** `GET /api/cuentas/:id` (CTA-1): la cuenta de una clínica (saldo, saldo a favor, antigüedad,
 * «Por cobrar» y movimientos). 404 si la clínica no existe. */
export async function fetchClinicAccount(id: string) {
  return (await throwIfNotOk(await cuentas[':id'].$get({ param: { id } }))).json()
}
export type ClinicAccount = Awaited<ReturnType<typeof fetchClinicAccount>>

/** `GET /api/cuentas/:id/estado?desde&hasta` (CTA-5): el estado de cuenta de una clínica por
 * rango (saldo inicial, movimientos con saldo corrido, saldo final, antigüedad y «Por cobrar» a
 * `hasta`). 404 si la clínica no existe; 422 si `desde > hasta`. */
export async function fetchAccountStatement(id: string, query: AccountStatementQuery) {
  return (await throwIfNotOk(await cuentas[':id'].estado.$get({ param: { id }, query }))).json()
}
export type AccountStatement = Awaited<ReturnType<typeof fetchAccountStatement>>

/** `POST /api/cuentas/pagos` (CTA-2): registra un pago y su reparto. Lo no repartido queda a
 * favor de la clínica. 422 con el campo (`asignaciones.N.monto`, `fecha`…). */
export async function registerPayment(input: PaymentInput) {
  return (await (await throwIfNotOk(await cuentas.pagos.$post({ json: input }))).json()).pago
}
export type Payment = Awaited<ReturnType<typeof registerPayment>>

/** `POST /api/cuentas/pagos/:id/asignaciones` (CTA-2): reparte lo que le queda a favor a un pago.
 * 409 si el pago está anulado. */
export async function applyCredit(paymentId: string, input: ApplyCreditInput) {
  const res = await cuentas.pagos[':id'].asignaciones.$post({
    param: { id: paymentId },
    json: input,
  })
  return (await (await throwIfNotOk(res)).json()).pago
}

/** `POST /api/cuentas/pagos/:id/anular` (CTA-2, solo admin): 409 si ya estaba anulado. */
export async function voidPayment(paymentId: string, input: VoidPaymentInput) {
  const res = await cuentas.pagos[':id'].anular.$post({ param: { id: paymentId }, json: input })
  return (await (await throwIfNotOk(res)).json()).pago
}

/** `POST /api/cuentas/ajustes` (CTA-3, solo admin): descuento o recargo, con o sin trabajo. */
export async function registerAdjustment(input: AdjustmentInput) {
  return (await (await throwIfNotOk(await cuentas.ajustes.$post({ json: input }))).json()).ajuste
}
