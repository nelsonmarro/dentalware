import { describe, expect, it } from 'vitest'
import {
  ACTIONS_REQUIRING_REASON,
  applyAction,
  ASSIGN_TECHNICIAN_ROLES,
  availableActions,
  canAssignTechnician,
  canChangeStage,
  canPerform,
  canRemake,
  CASE_ACTIONS,
  CASE_STATUSES,
  CASE_WRITE_ROLES,
  EDITABLE_CASE_STATUSES,
  isEditableStatus,
  REMAKE_ROLES,
  REMAKEABLE_STATUSES,
  STAGE_CHANGE_BLOCKED_REASON,
  STAGE_CHANGE_ROLES,
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

describe('canRemake', () => {
  it('define terminado, enviado y entregado como los únicos estados desde los que se repite', () => {
    expect(REMAKEABLE_STATUSES).toEqual(['terminado', 'enviado', 'entregado'])
  })

  it('responde true solo para terminado, enviado y entregado', () => {
    for (const s of CASE_STATUSES) {
      expect(canRemake(s)).toBe(s === 'terminado' || s === 'enviado' || s === 'entregado')
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

describe('roles por acción sobre el trabajo (I-5 + M-5 + M-9, fuente única en shared)', () => {
  it('CASE_WRITE_ROLES es admin y recepción', () => {
    expect([...CASE_WRITE_ROLES].sort()).toEqual(['admin', 'recepcion'])
  })

  it('STAGE_CHANGE_ROLES suma al técnico (CIC-2)', () => {
    expect([...STAGE_CHANGE_ROLES].sort()).toEqual(['admin', 'recepcion', 'tecnico'])
  })

  it('ASSIGN_TECHNICIAN_ROLES y REMAKE_ROLES son admin y recepción (CIC-5/CIC-4)', () => {
    expect([...ASSIGN_TECHNICIAN_ROLES].sort()).toEqual(['admin', 'recepcion'])
    expect([...REMAKE_ROLES].sort()).toEqual(['admin', 'recepcion'])
  })
})

describe('canChangeStage', () => {
  it('solo en_proceso puede cambiar de fase (CIC-2)', () => {
    for (const s of CASE_STATUSES) {
      expect(canChangeStage(s)).toBe(s === 'en_proceso')
    }
  })
})

describe('canAssignTechnician', () => {
  it('bloquea entregado y cancelado; el resto de estados sí permite reasignar (CIC-5)', () => {
    for (const s of CASE_STATUSES) {
      expect(canAssignTechnician(s)).toBe(s !== 'entregado' && s !== 'cancelado')
    }
  })
})

describe('STAGE_CHANGE_BLOCKED_REASON', () => {
  it('tiene un motivo en español para cada estado que no sea en_proceso', () => {
    const estadosBloqueados = CASE_STATUSES.filter((s) => s !== 'en_proceso')
    for (const s of estadosBloqueados) {
      expect(typeof STAGE_CHANGE_BLOCKED_REASON[s]).toBe('string')
      expect(STAGE_CHANGE_BLOCKED_REASON[s]!.length).toBeGreaterThan(0)
    }
  })
})
