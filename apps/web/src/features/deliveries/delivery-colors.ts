import type { DeliveryStatus, DeliveryType } from '@dentalware/shared'
import { STATUS_COLOR } from '@/features/cases/status-chip'

/** Color de cada tipo de entrega, tomado del estado del trabajo que acompaña (`STATUS_COLOR`,
 * con su contraste AA ya probado en `status-chip.test.tsx`): la recogida es el gris de «Por
 * recoger» y la entrega el azul de «Enviado». `Record` exhaustivo. */
export const DELIVERY_TYPE_COLOR: Record<DeliveryType, string> = {
  recogida: STATUS_COLOR.por_recoger,
  entrega: STATUS_COLOR.enviado,
}

/** Color de una entrega cerrada: hecha con el verde de «Entregado», fallida con el rojo de
 * «Cancelado». Una pendiente no lleva chip: es el estado por omisión y su acción ya lo dice. */
export const DELIVERY_CLOSED_COLOR: Record<Exclude<DeliveryStatus, 'pendiente'>, string> = {
  hecha: STATUS_COLOR.entregado,
  fallida: STATUS_COLOR.cancelado,
}
