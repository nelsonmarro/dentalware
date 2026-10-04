import { describe, expect, it } from 'vitest'
import {
  ATTACHMENT_UPLOAD_ROLES,
  CONSTANCIA_INVALIDA,
  DELIVERY_MANAGE_ROLES,
  DELIVERY_NOT_PENDING_MESSAGE,
  DELIVERY_ROLES,
  DELIVERY_STATUS_LABEL,
  DELIVERY_TYPE_LABEL,
  DELIVERY_CLOSED_BY_ACTION,
  canActOnDelivery,
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
  it('mensaje de entrega ya no pendiente', () => {
    expect(DELIVERY_NOT_PENDING_MESSAGE).toBe('Esta entrega ya no está pendiente.')
  })

  it('cada acción de estado dice qué entrega pendiente cierra', () => {
    expect(DELIVERY_CLOSED_BY_ACTION).toEqual({
      recibir: 'recogida',
      aceptar: null,
      pausar: null,
      reanudar: null,
      enviar_prueba: null,
      recibir_prueba: null,
      finalizar: null,
      marcar_enviado: null,
      marcar_entregado: 'entrega',
      cancelar: null,
    })
  })
  // M-4 (revisión final del PR 1): el mensajero solo ve y ejecuta la acción de la entrega que
  // tiene asignada; admin y recepción actúan sobre cualquiera.
  describe('canActOnDelivery', () => {
    const yo = { role: 'mensajero', userId: 'm1' } as const
    it('el mensajero recibe su propia recogida pendiente', () => {
      expect(canActOnDelivery(yo, 'recibir', { type: 'recogida', courierId: 'm1' })).toBe(true)
    })
    it('el mensajero no recibe la recogida de otro mensajero', () => {
      expect(canActOnDelivery(yo, 'recibir', { type: 'recogida', courierId: 'm2' })).toBe(false)
    })
    it('el mensajero no entrega sin entrega pendiente', () => {
      expect(canActOnDelivery(yo, 'marcar_entregado', null)).toBe(false)
    })
    it('el mensajero no entrega con una pendiente de otro tipo', () => {
      expect(canActOnDelivery(yo, 'marcar_entregado', { type: 'recogida', courierId: 'm1' })).toBe(
        false,
      )
    })
    it('el mensajero entrega su propia entrega pendiente', () => {
      expect(canActOnDelivery(yo, 'marcar_entregado', { type: 'entrega', courierId: 'm1' })).toBe(
        true,
      )
    })
    it('marcar enviado no depende de una entrega pendiente', () => {
      expect(canActOnDelivery(yo, 'marcar_enviado', null)).toBe(true)
    })
    it.each(['admin', 'recepcion'] as const)('%s actúa sobre la entrega de cualquiera', (role) => {
      const ctx = { role, userId: 'r1' }
      expect(canActOnDelivery(ctx, 'recibir', { type: 'recogida', courierId: 'm2' })).toBe(true)
      expect(canActOnDelivery(ctx, 'marcar_entregado', null)).toBe(true)
    })
  })
})
