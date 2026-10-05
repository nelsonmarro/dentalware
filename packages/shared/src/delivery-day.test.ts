import { describe, expect, it } from 'vitest'
import {
  DELIVERY_FAIL_REASONS,
  DELIVERY_OUTCOME_LABEL,
  cancelledDeliveryNote,
  compareStopDeliveries,
  deliveryDaySummary,
  deliveryOutcome,
} from './delivery-day.ts'

type Item = Parameters<typeof deliveryDaySummary>[0][number]

function item(over: Partial<Item> = {}): Item {
  return {
    status: 'pendiente',
    scheduledFor: '2026-10-03',
    failedReason: null,
    case: { status: 'enviado', priority: 'normal' },
    ...over,
  }
}

const TODAY = '2026-10-03'
const cancelada = item({
  status: 'fallida',
  failedReason: 'Trabajo cancelado: la clínica lo anuló',
  case: { status: 'cancelado', priority: 'normal' },
})

describe('motivos frecuentes de «No se pudo» (UX4-12)', () => {
  it('son estos cuatro, en este orden', () => {
    expect(DELIVERY_FAIL_REASONS).toEqual([
      'Clínica cerrada',
      'Nadie para recibir',
      'Dirección incorrecta',
      'Falta pago',
    ])
  })
})

describe('deliveryOutcome (UX4-17)', () => {
  it('una pendiente no tiene resultado', () => {
    expect(deliveryOutcome(item())).toBeNull()
  })
  it('la cerrada por la cancelación del trabajo está anulada, no fallida', () => {
    expect(deliveryOutcome(cancelada)).toBe('anulada')
  })
  it('una fallida real y una hecha conservan su estado', () => {
    expect(deliveryOutcome(item({ status: 'fallida', failedReason: 'Clínica cerrada' }))).toBe(
      'fallida',
    )
    expect(deliveryOutcome(item({ status: 'hecha' }))).toBe('hecha')
  })
  it('rótulos', () => {
    expect(DELIVERY_OUTCOME_LABEL).toEqual({
      hecha: 'Hecha',
      fallida: 'Fallida',
      anulada: 'Anulada',
    })
  })
})

describe('cancelledDeliveryNote (UX4-17)', () => {
  it('dice que el trabajo se canceló y por qué', () => {
    expect(cancelledDeliveryNote('Trabajo cancelado: la clínica lo anuló')).toBe(
      'Trabajo cancelado: la clínica lo anuló',
    )
  })
  it('sin motivo no deja los dos puntos colgando', () => {
    expect(cancelledDeliveryNote('Trabajo cancelado: ')).toBe('Trabajo cancelado')
    expect(cancelledDeliveryNote(null)).toBe('Trabajo cancelado')
  })
})

describe('deliveryDaySummary (UX4-18)', () => {
  it('cuenta pendientes, atrasadas, hechas, fallidas y anuladas', () => {
    expect(
      deliveryDaySummary(
        [
          item(),
          item({ scheduledFor: '2026-10-02' }),
          item({ status: 'hecha' }),
          item({ status: 'fallida', failedReason: 'Clínica cerrada' }),
          item({ status: 'fallida', failedReason: 'Falta pago' }),
          cancelada,
        ],
        TODAY,
      ),
    ).toBe('2 pendientes · 1 atrasada · 1 hecha · 2 fallidas · 1 anulada')
  })
  it('omite lo que está en cero, salvo las pendientes', () => {
    expect(deliveryDaySummary([item({ status: 'hecha' }), item({ status: 'hecha' })], TODAY)).toBe(
      '0 pendientes · 2 hechas',
    )
    expect(deliveryDaySummary([item(), cancelada, cancelada], TODAY)).toBe(
      '1 pendiente · 2 anuladas',
    )
  })
  it('una pendiente de un trabajo cancelado no cuenta como pendiente', () => {
    expect(
      deliveryDaySummary([item({ case: { status: 'cancelado', priority: 'normal' } })], TODAY),
    ).toBe('0 pendientes')
  })
})

describe('compareStopDeliveries (UX4-19)', () => {
  const sort = (xs: (Item & { id: string })[]) =>
    [...xs].sort((a, b) => compareStopDeliveries(a, b, TODAY)).map((x) => x.id)

  it('dentro de una parada, lo urgente pendiente va primero', () => {
    expect(
      sort([
        { ...item(), id: 'normal' },
        { ...item({ case: { status: 'enviado', priority: 'urgente' } }), id: 'urgente' },
      ]),
    ).toEqual(['urgente', 'normal'])
  })
  it('después de lo urgente, lo atrasado; luego por fecha', () => {
    expect(
      sort([
        { ...item({ scheduledFor: '2026-10-03' }), id: 'hoy' },
        { ...item({ scheduledFor: '2026-10-02' }), id: 'ayer' },
        { ...item({ scheduledFor: '2026-10-01' }), id: 'anteayer' },
        {
          ...item({ scheduledFor: '2026-10-03', case: { status: 'enviado', priority: 'urgente' } }),
          id: 'urgente',
        },
      ]),
    ).toEqual(['urgente', 'anteayer', 'ayer', 'hoy'])
  })
  it('lo cerrado va al final aunque sea urgente', () => {
    expect(
      sort([
        {
          ...item({ status: 'hecha', case: { status: 'entregado', priority: 'urgente' } }),
          id: 'hecha',
        },
        { ...cancelada, id: 'anulada' },
        { ...item(), id: 'pendiente' },
      ]),
    ).toEqual(['pendiente', 'hecha', 'anulada'])
  })
})
