import { describe, expect, it } from 'vitest'
import {
  ACTIONS_REQUIRING_REASON,
  applyAction,
  availableActions,
  canPerform,
  CASE_ACTIONS,
  CASE_STATUSES,
  EDITABLE_CASE_STATUSES,
  isEditableStatus,
} from './case-status.ts'

describe('estados y acciones', () => {
  it('define los 8 estados del spec en orden', () => {
    expect(CASE_STATUSES).toEqual([
      'nuevo',
      'en_proceso',
      'en_espera',
      'en_prueba',
      'terminado',
      'enviado',
      'entregado',
      'cancelado',
    ])
  })

  it('define las 9 acciones', () => {
    expect([...CASE_ACTIONS].sort()).toEqual(
      [
        'aceptar',
        'pausar',
        'reanudar',
        'enviar_prueba',
        'recibir_prueba',
        'finalizar',
        'marcar_enviado',
        'marcar_entregado',
        'cancelar',
      ].sort(),
    )
  })
})

describe('isEditableStatus', () => {
  it('define nuevo y en_proceso como los únicos estados editables', () => {
    expect(EDITABLE_CASE_STATUSES).toEqual(['nuevo', 'en_proceso'])
  })

  it('responde true solo para nuevo y en_proceso', () => {
    for (const s of CASE_STATUSES) {
      expect(isEditableStatus(s)).toBe(s === 'nuevo' || s === 'en_proceso')
    }
  })
})

describe('applyAction — camino feliz', () => {
  it.each([
    ['nuevo', 'aceptar', 'en_proceso'],
    ['en_proceso', 'pausar', 'en_espera'],
    ['en_espera', 'reanudar', 'en_proceso'],
    ['en_proceso', 'enviar_prueba', 'en_prueba'],
    ['en_prueba', 'recibir_prueba', 'en_proceso'],
    ['en_proceso', 'finalizar', 'terminado'],
    ['terminado', 'marcar_enviado', 'enviado'],
    ['enviado', 'marcar_entregado', 'entregado'],
  ] as const)('%s + %s → %s', (from, action, to) => {
    expect(applyAction(from, action)).toEqual({ ok: true, status: to })
  })

  it('cancelar es válido desde cualquier estado excepto entregado y cancelado', () => {
    for (const s of CASE_STATUSES) {
      const result = applyAction(s, 'cancelar')
      if (s === 'entregado' || s === 'cancelado') expect(result.ok).toBe(false)
      else expect(result).toEqual({ ok: true, status: 'cancelado' })
    }
  })
})

describe('applyAction — transiciones inválidas', () => {
  it('rechaza con motivo legible', () => {
    expect(applyAction('nuevo', 'finalizar')).toEqual({
      ok: false,
      reason: 'No se puede "finalizar" un trabajo en estado "nuevo"',
    })
    expect(applyAction('entregado', 'aceptar').ok).toBe(false)
    expect(applyAction('cancelado', 'reanudar').ok).toBe(false)
  })
})

describe('availableActions', () => {
  it('lista solo las acciones válidas para el estado', () => {
    expect(availableActions('nuevo').sort()).toEqual(['aceptar', 'cancelar'])
    expect(availableActions('en_proceso').sort()).toEqual(
      ['pausar', 'enviar_prueba', 'finalizar', 'cancelar'].sort(),
    )
    expect(availableActions('entregado')).toEqual([])
    expect(availableActions('cancelado')).toEqual([])
  })
})

describe('motivo obligatorio y permisos por rol', () => {
  it('pausar y cancelar exigen motivo', () => {
    expect([...ACTIONS_REQUIRING_REASON].sort()).toEqual(['cancelar', 'pausar'])
  })

  it('aplica la tabla de roles del spec', () => {
    expect(canPerform('admin', 'aceptar')).toBe(true)
    expect(canPerform('recepcion', 'aceptar')).toBe(true)
    expect(canPerform('tecnico', 'aceptar')).toBe(false)
    expect(canPerform('tecnico', 'finalizar')).toBe(true)
    expect(canPerform('mensajero', 'marcar_enviado')).toBe(true)
    expect(canPerform('mensajero', 'marcar_entregado')).toBe(true)
    expect(canPerform('mensajero', 'finalizar')).toBe(false)
    expect(canPerform('tecnico', 'cancelar')).toBe(false)
  })
})
