export const CASE_EVENT_TYPES = [
  'created',
  'status_changed',
  'stage_changed',
  'assigned',
  'hold',
  'resumed',
  'tryin_sent',
  'tryin_returned',
  'comment',
  'attachment_added',
  'attachment_removed',
  'shipped',
  'delivered',
  'pickup_scheduled',
  'picked_up',
  'received',
  'delivery_failed',
  'cancelled',
  'remake_created',
  'edited',
  'price_changed',
  // Iteración 5 (cuentas y cobro): `payment_applied` guarda el monto asignado en `toValue` y el
  // método y la referencia del pago en `reason`; `payment_voided`, el monto devuelto y el
  // motivo; `adjustment_added`, el monto con signo y el motivo. Son importes: técnico y
  // mensajero no los ven (`maskPriceEvents`).
  'payment_applied',
  'payment_voided',
  'adjustment_added',
] as const
export type CaseEventType = (typeof CASE_EVENT_TYPES)[number]

/**
 * ¿Lleva importes el evento? Técnico y mensajero no los ven (`hidesPrices`): la API les quita
 * `fromValue`, `toValue` y `reason` (`maskPriceEvents`), como los precios (ADR 7). `Record`
 * exhaustivo: un tipo de evento nuevo no compila sin decidir si muestra dinero.
 */
export const CASE_EVENT_CARRIES_AMOUNTS: Record<CaseEventType, boolean> = {
  created: false,
  status_changed: false,
  stage_changed: false,
  assigned: false,
  hold: false,
  resumed: false,
  tryin_sent: false,
  tryin_returned: false,
  comment: false,
  attachment_added: false,
  attachment_removed: false,
  shipped: false,
  delivered: false,
  pickup_scheduled: false,
  picked_up: false,
  received: false,
  delivery_failed: false,
  cancelled: false,
  remake_created: false,
  edited: false,
  // "productId:precio" en `fromValue`/`toValue`.
  price_changed: true,
  // Monto en `toValue`; método y referencia del pago, o el motivo, en `reason`.
  payment_applied: true,
  payment_voided: true,
  adjustment_added: true,
}
