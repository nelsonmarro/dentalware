import { api } from '@/lib/api'
import { throwIfNotOk } from '@/lib/api-error'

const entregas = api.api.entregas

/** `GET /api/entregas/mensajeros` (decisión 8 del plan): mensajeros activos `{ id, name }`,
 * ordenados por nombre. Solo admin y recepción (`DELIVERY_MANAGE_ROLES`); el mensajero recibe
 * 403, así que nunca se le pide. */
export async function fetchCouriers() {
  return (await (await throwIfNotOk(await entregas.mensajeros.$get())).json()).mensajeros
}
export type Courier = Awaited<ReturnType<typeof fetchCouriers>>[number]
