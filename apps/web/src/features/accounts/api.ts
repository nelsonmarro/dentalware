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
