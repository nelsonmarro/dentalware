import { describe, expect, it } from 'vitest'
import {
  ATTACHMENT_UPLOAD_ROLES,
  CONSTANCIA_INVALIDA,
  DELIVERY_MANAGE_ROLES,
  DELIVERY_NOT_PENDING_MESSAGE,
  DELIVERY_ROLES,
  DELIVERY_STATUS_LABEL,
  DELIVERY_TYPE_LABEL,
  DELIVERY_ALREADY_CLOSED_MESSAGE,
  DELIVERY_CLOSED_BY_ACTION,
  DELIVERY_CLOSING_ACTION,
  DELIVERY_FAILED_LABEL,
  DELIVERY_PROOF_LOCKED_MESSAGE,
  DELIVERY_TYPES,
  canActOnDelivery,
  canFailDelivery,
  cancelledDeliveryReason,
  deliveryNextStep,
  isOwnDelivery,
  courierTaskTitle,
  deliveredLine,
  pendingDeliveryLine,
  courierNoActionReason,
  actionsFor,
  isClosedByCancellation,
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
  it('mensaje al borrar la constancia de una entrega hecha (UX4-06)', () => {
    expect(DELIVERY_PROOF_LOCKED_MESSAGE).toBe(
      'Es la constancia de la entrega: no se puede borrar.',
    )
  })
  it('rótulo del historial de lo que no se pudo hacer, por tipo (UX4-16)', () => {
    expect(DELIVERY_FAILED_LABEL).toEqual({
      recogida: 'Recogida fallida',
      entrega: 'Entrega fallida',
    })
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
  it('mensaje de entrega cerrada por otra persona', () => {
    expect(DELIVERY_ALREADY_CLOSED_MESSAGE).toBe(
      'La entrega ya no está pendiente. Puede que otra persona la haya cerrado.',
    )
  })

  // M-3 de la revisión final del PR 2: «Cancelado» solo para la entrega que cerró la
  // cancelación, reconocida por el prefijo de su motivo (una sola fuente con la API).
  it('el motivo de una entrega cerrada al cancelar lleva el prefijo de cancelación', () => {
    expect(cancelledDeliveryReason('La clínica lo anuló')).toBe(
      'Trabajo cancelado: La clínica lo anuló',
    )
  })
  it('solo una fallida con el prefijo de cancelación se cerró por la cancelación', () => {
    const motivo = cancelledDeliveryReason('La clínica lo anuló')
    expect(isClosedByCancellation({ status: 'fallida', failedReason: motivo })).toBe(true)
    expect(isClosedByCancellation({ status: 'fallida', failedReason: 'Clínica cerrada' })).toBe(
      false,
    )
    expect(isClosedByCancellation({ status: 'fallida', failedReason: null })).toBe(false)
    expect(isClosedByCancellation({ status: 'hecha', failedReason: motivo })).toBe(false)
    expect(isClosedByCancellation({ status: 'pendiente', failedReason: null })).toBe(false)
  })

  // M-2 de la revisión final del PR 2: una sola fuente para «qué acción cierra cada tipo de
  // entrega» (la usan la tarjeta de la web y `fail` de la API), coherente con la inversa.
  it('cada tipo de entrega dice qué acción la cierra', () => {
    expect(DELIVERY_CLOSING_ACTION).toEqual({ recogida: 'recibir', entrega: 'marcar_entregado' })
  })
  it('la acción que cierra cada tipo es la que DELIVERY_CLOSED_BY_ACTION asigna a ese tipo', () => {
    for (const type of DELIVERY_TYPES) {
      expect(DELIVERY_CLOSED_BY_ACTION[DELIVERY_CLOSING_ACTION[type]]).toBe(type)
    }
  })

  // M-4 (revisión final del PR 1): el mensajero solo ve y ejecuta la acción de la entrega que
  // tiene asignada; admin y recepción actúan sobre cualquiera.
  describe('canActOnDelivery', () => {
    const yo = { role: 'mensajero', userId: 'm1' } as const
    // Sin el rol (UX4-10, `canPerform`), esto solo dice si la recogida es suya.
    it('la recogida pendiente del mensajero es suya', () => {
      expect(canActOnDelivery(yo, 'recibir', { type: 'recogida', courierId: 'm1' })).toBe(true)
    })
    it('la recogida de otro mensajero no es suya', () => {
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

  // UX4-07: la ficha corta del mensajero dice qué hacer, cuándo y dónde, no la fecha comprometida.
  describe('courierTaskTitle', () => {
    it('una entrega se rotula con el verbo «Entregar»', () => {
      expect(courierTaskTitle('entrega', 'hoy', 'Clínica Norte')).toBe(
        'Entregar hoy en Clínica Norte',
      )
    })
    it('una recogida se rotula con el verbo «Recoger», no «Recibir»', () => {
      expect(courierTaskTitle('recogida', 'el 09/10/2026', 'Clínica Sur')).toBe(
        'Recoger el 09/10/2026 en Clínica Sur',
      )
    })
  })

  // UX4-08: la ficha corta del mensajero sin acción dice por qué, nunca queda muda.
  describe('courierNoActionReason', () => {
    const pendiente = (type: 'recogida' | 'entrega', courierId: string) => ({
      type,
      courierId,
      courierName: 'Luis Mensajero T7',
      scheduledFor: '2026-10-04',
    })
    it('una recogida de otro mensajero dice quién la tiene', () => {
      expect(courierNoActionReason(pendiente('recogida', 'm2'), 'm1')).toBe(
        'Esta recogida la tiene Luis Mensajero T7.',
      )
    })
    it('una entrega de otro mensajero dice quién la tiene', () => {
      expect(courierNoActionReason(pendiente('entrega', 'm2'), 'm1')).toBe(
        'Esta entrega la tiene Luis Mensajero T7.',
      )
    })
    it('sin entrega pendiente dice que no hay nada para él', () => {
      expect(courierNoActionReason(null, 'm1')).toBe(
        'Este trabajo no tiene una entrega pendiente para ti.',
      )
    })
    it('la suya no necesita motivo: su tarea ya dice qué hacer', () => {
      expect(courierNoActionReason(pendiente('entrega', 'm1'), 'm1')).toBeNull()
    })
    // UX4-10: la recogida la cierra recepción al llegar; el mensajero sabe que no le toca.
    it('su recogida dice que recepción la marca al llegar', () => {
      expect(courierNoActionReason(pendiente('recogida', 'm1'), 'm1')).toBe(
        'Recepción lo marca como recibido al llegar al laboratorio.',
      )
    })
  })

  // Minor de T5: «¿es el mensajero asignado?», una sola regla.
  describe('isOwnDelivery', () => {
    it('es suya si está asignada a él', () => {
      expect(isOwnDelivery('m1', { courierId: 'm1' })).toBe(true)
    })
    it('no es suya si la tiene otro', () => {
      expect(isOwnDelivery('m1', { courierId: 'm2' })).toBe(false)
    })
    it('sin entrega no hay nada suyo', () => {
      expect(isOwnDelivery('m1', null)).toBe(false)
      expect(isOwnDelivery('m1', undefined)).toBe(false)
    })
  })

  // UX4-10: «No se pudo» no depende de quién cierra la entrega. El mensajero dueño lo marca en
  // su recogida aunque «Recibido» sea de recepción.
  describe('canFailDelivery', () => {
    const yo = { role: 'mensajero', userId: 'm1' } as const
    it('el mensajero marca «No se pudo» en su propia recogida', () => {
      expect(canFailDelivery(yo, { type: 'recogida', courierId: 'm1' })).toBe(true)
    })
    it('el mensajero marca «No se pudo» en su propia entrega', () => {
      expect(canFailDelivery(yo, { type: 'entrega', courierId: 'm1' })).toBe(true)
    })
    it('el mensajero no marca «No se pudo» en la de otro', () => {
      expect(canFailDelivery(yo, { type: 'recogida', courierId: 'm2' })).toBe(false)
    })
    it.each(['admin', 'recepcion'] as const)('%s lo marca en la de cualquiera', (role) => {
      expect(canFailDelivery({ role, userId: 'r1' }, { type: 'recogida', courierId: 'm2' })).toBe(
        true,
      )
    })
    it('el técnico no lo marca', () => {
      expect(
        canFailDelivery({ role: 'tecnico', userId: 't1' }, { type: 'entrega', courierId: 't1' }),
      ).toBe(false)
    })
  })

  // UX4-10: qué sigue cuando quien ve la entrega no la puede cerrar.
  describe('deliveryNextStep', () => {
    it('al mensajero, en una recogida, le dice que recepción la marca al llegar', () => {
      expect(deliveryNextStep('mensajero', 'recogida')).toBe(
        'Recepción lo marca como recibido al llegar al laboratorio.',
      )
    })
    it('quien cierra la entrega no necesita aviso', () => {
      expect(deliveryNextStep('mensajero', 'entrega')).toBeNull()
      expect(deliveryNextStep('recepcion', 'recogida')).toBeNull()
      expect(deliveryNextStep('admin', 'recogida')).toBeNull()
    })
  })

  // Una sola regla para la barra de acciones y para saber si la ficha corta queda sin acción.
  describe('actionsFor', () => {
    const yo = { role: 'mensajero', userId: 'm1' } as const
    it('el mensajero ve «Marcar entregado» solo en su propia entrega', () => {
      expect(actionsFor(yo, 'enviado', { type: 'entrega', courierId: 'm1' })).toEqual([
        'marcar_entregado',
      ])
      expect(actionsFor(yo, 'enviado', { type: 'entrega', courierId: 'm2' })).toEqual([])
    })
    it('el mensajero no tiene acciones en un trabajo en producción', () => {
      expect(actionsFor(yo, 'en_proceso', null)).toEqual([])
    })
    it('el mensajero no ve «Recibido» ni en su propia recogida (UX4-10)', () => {
      expect(actionsFor(yo, 'por_recoger', { type: 'recogida', courierId: 'm1' })).toEqual([])
    })
    it('recepción ve «Recibido» en cualquier recogida', () => {
      expect(
        actionsFor({ role: 'recepcion', userId: 'r1' }, 'por_recoger', {
          type: 'recogida',
          courierId: 'm1',
        }),
      ).toEqual(['recibir', 'cancelar'])
    })
    it('recepción ve las acciones de su rol en el estado', () => {
      expect(actionsFor({ role: 'recepcion', userId: 'r1' }, 'enviado', null)).toEqual([
        'marcar_entregado',
        'cancelar',
      ])
    })
  })

  // UX4-09: la ficha completa dice con quién sale, para cuándo, y quién lo entregó.
  describe('pendingDeliveryLine', () => {
    it('la recogida dice para cuándo está programada y con quién', () => {
      expect(pendingDeliveryLine('recogida', 'hoy', 'Mario')).toBe(
        'Recogida programada para hoy con Mario',
      )
    })
    it('la entrega dice cuándo sale y con quién', () => {
      expect(pendingDeliveryLine('entrega', 'el 04/10/2026', 'Mario')).toBe(
        'Sale el 04/10/2026 con Mario',
      )
    })
    it('lo entregado dice cuándo y quién', () => {
      expect(deliveredLine('04/10/2026', 'Mario')).toBe('Entregado el 04/10/2026 por Mario')
    })
  })
})
