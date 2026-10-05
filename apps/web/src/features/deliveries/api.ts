import type { DeliveryFailInput } from '@dentalware/shared'
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

/** `GET /api/entregas?dia=&mensajeroId=` (ENT-5, decisión 7 del plan): las recogidas y entregas
 * del día, sin dinero. El mensajero recibe solo las suyas (la API ignora `mensajeroId`); el día
 * de hoy trae también las pendientes atrasadas. Sin `mensajeroId`, admin y recepción ven todas. */
export async function fetchDeliveries({ dia, mensajeroId }: { dia: string; mensajeroId?: string }) {
  const query = mensajeroId ? { dia, mensajeroId } : { dia }
  return (await (await throwIfNotOk(await entregas.$get({ query }))).json()).entregas
}
export type DeliveryItem = Awaited<ReturnType<typeof fetchDeliveries>>[number]

/** `POST /api/entregas/:id/fallida` (ENT-5, decisión 6 del plan): cierra la entrega como
 * fallida con su motivo y programa otra pendiente para `nuevaFecha`, con el mismo mensajero.
 * 409 si ya no estaba pendiente (`DELIVERY_NOT_PENDING_MESSAGE`). */
export async function failDelivery(id: string, input: DeliveryFailInput) {
  return (
    await (
      await throwIfNotOk(await entregas[':id'].fallida.$post({ param: { id }, json: input }))
    ).json()
  ).entrega
}

/** `POST /api/entregas/:id/recogido` (#118): el mensajero recogió en la clínica. Cierra la
 * recogida sin cambiar el estado del trabajo, que sigue por recoger hasta «Recibido». 409 si ya
 * no estaba pendiente (`DELIVERY_NOT_PENDING_MESSAGE`). */
export async function pickUpDelivery(id: string) {
  return (
    await (await throwIfNotOk(await entregas[':id'].recogido.$post({ param: { id } }))).json()
  ).entrega
}
