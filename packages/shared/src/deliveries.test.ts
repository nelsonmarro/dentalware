import { describe, expect, it } from 'vitest'
import {
  ATTACHMENT_UPLOAD_ROLES,
  CONSTANCIA_INVALIDA,
  DELIVERY_MANAGE_ROLES,
  DELIVERY_ROLES,
  DELIVERY_STATUS_LABEL,
  DELIVERY_TYPE_LABEL,
  isOverdueDelivery,
} from './deliveries.ts'

describe('entregas', () => {
  it('rótulos', () => {
    expect(DELIVERY_TYPE_LABEL).toEqual({ recogida: 'Recogida', entrega: 'Entrega' })
    expect(DELIVERY_STATUS_LABEL).toEqual({
      pendiente: 'Pendiente',
      hecha: 'Hecha',
      fallida: 'Fallida',
    })
  })
  it('roles', () => {
    expect(DELIVERY_MANAGE_ROLES).toEqual(['admin', 'recepcion'])
    expect(DELIVERY_ROLES).toEqual(['admin', 'recepcion', 'mensajero'])
    expect(ATTACHMENT_UPLOAD_ROLES).toEqual(['admin', 'recepcion', 'tecnico'])
  })
  it('atrasada solo si sigue pendiente y su fecha ya pasó', () => {
    expect(
      isOverdueDelivery({ status: 'pendiente', scheduledFor: '2026-10-02' }, '2026-10-03'),
    ).toBe(true)
    expect(
      isOverdueDelivery({ status: 'pendiente', scheduledFor: '2026-10-03' }, '2026-10-03'),
    ).toBe(false)
    expect(isOverdueDelivery({ status: 'hecha', scheduledFor: '2026-10-01' }, '2026-10-03')).toBe(
      false,
    )
  })
  it('mensaje de constancia inválida', () => {
    expect(CONSTANCIA_INVALIDA).toBe('La foto de constancia no es de este trabajo.')
  })
})
