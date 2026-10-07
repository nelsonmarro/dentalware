import { describe, expect, it } from 'vitest'
import { CASE_EVENT_TYPES } from './case-events.ts'

describe('tipos de evento del trabajo', () => {
  // Iteración 5 (decisión 11): el cobro suma tres eventos al final; `status_changed` ya cubre
  // `entregado ⇄ cobrado`.
  it('define los 24 tipos, con los tres del cobro al final', () => {
    expect(CASE_EVENT_TYPES).toEqual([
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
      'payment_applied',
      'payment_voided',
      'adjustment_added',
    ])
  })
})
