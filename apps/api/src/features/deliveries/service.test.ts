import { describe, expect, it } from 'vitest'
import { createDeliveriesService } from './service.ts'

describe('features/deliveries/service', () => {
  it('couriers devuelve los mensajeros activos tal como los da el puerto, solo id y nombre', async () => {
    const service = createDeliveriesService({
      couriers: {
        activeCouriers: async () => [
          { id: 'u3', name: 'Luis Mensajero' },
          { id: 'u4', name: 'Mario Mensajero' },
        ],
      },
    })
    expect(await service.couriers()).toEqual([
      { id: 'u3', name: 'Luis Mensajero' },
      { id: 'u4', name: 'Mario Mensajero' },
    ])
  })
})
