import { describe, expect, it } from 'vitest'
import {
  deliveryFailSchema,
  deliveryListQuerySchema,
  pickupInputSchema,
  shipmentInputSchema,
} from './deliveries.ts'

const mensajeroId = '44444444-4444-4444-8444-444444444444'

describe('shipmentInputSchema', () => {
  it('exige mensajero y fecha', () => {
    expect(shipmentInputSchema.safeParse({}).success).toBe(false)
    expect(shipmentInputSchema.safeParse({ mensajeroId, fecha: '2026-10-05' }).success).toBe(true)
    expect(shipmentInputSchema.safeParse({ mensajeroId, fecha: '05/10/2026' }).success).toBe(false)
  })
})

describe('pickupInputSchema', () => {
  it('tiene la misma forma que shipmentInputSchema', () => {
    expect(pickupInputSchema.safeParse({}).success).toBe(false)
    expect(pickupInputSchema.safeParse({ mensajeroId, fecha: '2026-10-05' }).success).toBe(true)
  })
})

describe('deliveryListQuerySchema', () => {
  it('exige el día y acepta un mensajero opcional', () => {
    expect(deliveryListQuerySchema.safeParse({}).success).toBe(false)
    expect(deliveryListQuerySchema.safeParse({ dia: '2026-10-05' }).success).toBe(true)
    expect(deliveryListQuerySchema.safeParse({ dia: '2026-10-05', mensajeroId }).success).toBe(true)
  })
})

describe('deliveryFailSchema', () => {
  it('exige motivo y la nueva fecha', () => {
    expect(deliveryFailSchema.safeParse({}).success).toBe(false)
    expect(deliveryFailSchema.safeParse({ motivo: '   ', nuevaFecha: '2026-10-05' }).success).toBe(
      false,
    )
    expect(
      deliveryFailSchema.safeParse({ motivo: 'No había nadie', nuevaFecha: '2026-10-05' }).success,
    ).toBe(true)
  })

  // UX4-17: el prefijo de cancelación es lo que marca una entrega anulada; un «No se pudo» que
  // lo usara se vería como si el trabajo se hubiera cancelado.
  it('rechaza un motivo que empiece como el de la cancelación del trabajo', () => {
    const r = deliveryFailSchema.safeParse({
      motivo: '  Trabajo cancelado: era broma',
      nuevaFecha: '2026-10-05',
    })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe('El motivo no puede empezar por «Trabajo cancelado:»')
  })
})
