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
