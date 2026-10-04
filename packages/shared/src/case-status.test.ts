import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  ACTION_PAYLOAD,
  ACTIONS_REQUIRING_REASON,
  type ActionRequiringReason,
  type ActionRequiringDeliveryForm,
  ACTIVE_FOR_DATES_STATUSES,
  applyAction,
  ASSIGN_TECHNICIAN_ROLES,
  availableActions,
  canAssignTechnician,
  canChangeStage,
  canPerform,
  canRemake,
  CASE_ACTION_LABEL,
  CASE_PHASE,
  CASE_PHASE_TITLE,
  CASE_ACTION_ROLES,
  CASE_ACTIONS,
  CASE_STATUS_LABEL,
  CASE_STATUSES,
  CASE_TRANSITIONS,
  CASE_WRITE_ROLES,
  ATTACHMENT_DELETE_ROLES,
  canWriteCases,
  EDITABLE_CASE_STATUSES,
  EN_CURSO_STATUSES,
  isActiveForDates,
  isEditableStatus,
  notEditableMessage,
  requiresReason,
  requiresDeliveryForm,
  notReassignableMessage,
  notRemakeableMessage,
  isEnCurso,
  REMAKE_ROLES,
  REMAKEABLE_STATUSES,
  STAGE_CHANGE_BLOCKED_REASON,
  STAGE_MOVE_BLOCKED_REASON,
  STAGE_CHANGE_ROLES,
} from './case-status.ts'

describe('estados y acciones', () => {
  it('define los 9 estados (Iteración 4 suma por_recoger, primero) en orden', () => {
    expect(CASE_STATUSES).toEqual([
      'por_recoger',
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

  it('define las 10 acciones (Iteración 4 suma recibir, primero)', () => {
    expect([...CASE_ACTIONS].sort()).toEqual(
      [
        'recibir',
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

describe('recibir (Iteración 4, ENT-1)', () => {
  it('recibir lleva de por recoger a nuevo y lo pueden hacer admin, recepción y mensajero', () => {
    expect(applyAction('por_recoger', 'recibir')).toEqual({ ok: true, status: 'nuevo' })
    expect(applyAction('nuevo', 'recibir').ok).toBe(false)
    expect(canPerform('mensajero', 'recibir')).toBe(true)
    expect(canPerform('tecnico', 'recibir')).toBe(false)
  })

  it('un trabajo por recoger no se puede aceptar y sí cancelar', () => {
    expect(applyAction('por_recoger', 'aceptar').ok).toBe(false)
    expect(applyAction('por_recoger', 'cancelar')).toEqual({ ok: true, status: 'cancelado' })
  })

  it('carga útil de cada acción', () => {
    expect(ACTION_PAYLOAD).toEqual({
      recibir: 'ninguna',
      aceptar: 'ninguna',
      pausar: 'motivo',
      reanudar: 'ninguna',
      enviar_prueba: 'ninguna',
      recibir_prueba: 'ninguna',
      finalizar: 'ninguna',
      marcar_enviado: 'envio',
      marcar_entregado: 'constancia',
      cancelar: 'motivo',
    })
    expect(ACTIONS_REQUIRING_REASON).toEqual(['pausar', 'cancelar'])
  })

  it('rótulos de por recoger y recibir', () => {
    expect(CASE_STATUS_LABEL.por_recoger).toBe('Por recoger')
    expect(CASE_ACTION_LABEL.recibir).toBe('Recibido')
  })

  it('se edita por recoger, nuevo y en proceso', () => {
    expect(EDITABLE_CASE_STATUSES).toEqual(['por_recoger', 'nuevo', 'en_proceso'])
  })
})

describe('isEditableStatus', () => {
  it('define por recoger, nuevo y en_proceso como los únicos estados editables (ENT-1)', () => {
    expect(EDITABLE_CASE_STATUSES).toEqual(['por_recoger', 'nuevo', 'en_proceso'])
  })

  it('responde true solo para por_recoger, nuevo y en_proceso', () => {
    for (const s of CASE_STATUSES) {
      expect(isEditableStatus(s)).toBe(s === 'por_recoger' || s === 'nuevo' || s === 'en_proceso')
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
  // UX3-03: el 409 llega tal cual al toast; con las claves internas («marcar_entregado»,
  // «en_proceso») recepción leía jerga del código. Literales, no derivados de los rótulos.
  it('rechaza con los rótulos de la acción y del estado, no con las claves', () => {
    expect(applyAction('nuevo', 'finalizar')).toEqual({
      ok: false,
      reason:
        'No se puede "Finalizar": el trabajo está en estado "Nuevo". Puede que otra persona lo haya cambiado.',
    })
    expect(applyAction('en_proceso', 'marcar_entregado')).toEqual({
      ok: false,
      reason:
        'No se puede "Marcar entregado": el trabajo está en estado "En proceso". Puede que otra persona lo haya cambiado.',
    })
    expect(applyAction('entregado', 'aceptar').ok).toBe(false)
    expect(applyAction('cancelado', 'reanudar').ok).toBe(false)
  })
})

describe('applyAction — ningún motivo de rechazo lleva una clave interna', () => {
  it('ninguna combinación inválida de estado y acción deja un guion bajo en el texto', () => {
    for (const s of CASE_STATUSES) {
      for (const a of CASE_ACTIONS) {
        const result = applyAction(s, a)
        if (!result.ok) expect(result.reason).not.toMatch(/_/)
      }
    }
  })
})

// M-3 (revisión de la Tarea 3): todos los 409 por estado tienen la misma forma — «No se puede
// {qué}: el trabajo está en estado "{rótulo}".» más la causa probable. Literales a propósito.
describe('mensajes de 409 por estado', () => {
  it('editar', () => {
    expect(notEditableMessage('en_espera')).toBe(
      'No se puede editar: el trabajo está en estado "En espera". Puede que otra persona lo haya cambiado.',
    )
  })

  it('repetir', () => {
    expect(notRemakeableMessage('en_proceso')).toBe(
      'No se puede repetir: el trabajo está en estado "En proceso". Puede que otra persona lo haya cambiado.',
    )
  })

  it('reasignar el técnico', () => {
    expect(notReassignableMessage('entregado')).toBe(
      'No se puede reasignar el técnico: el trabajo está en estado "Entregado". Puede que otra persona lo haya cambiado.',
    )
  })
})

describe('rótulos de estado y de acción', () => {
  it('nombra cada estado como lo ve recepción', () => {
    expect(CASE_STATUS_LABEL).toEqual({
      por_recoger: 'Por recoger',
      nuevo: 'Nuevo',
      en_proceso: 'En proceso',
      en_espera: 'En espera',
      en_prueba: 'En prueba',
      terminado: 'Terminado',
      enviado: 'Enviado',
      entregado: 'Entregado',
      cancelado: 'Cancelado',
    })
  })

  it('nombra cada acción como el botón que la dispara', () => {
    expect(CASE_ACTION_LABEL).toEqual({
      recibir: 'Recibido',
      aceptar: 'Aceptar',
      pausar: 'Pausar',
      reanudar: 'Reanudar',
      enviar_prueba: 'Enviar a prueba',
      recibir_prueba: 'Recibir de prueba',
      finalizar: 'Finalizar',
      marcar_enviado: 'Marcar enviado',
      marcar_entregado: 'Marcar entregado',
      cancelar: 'Cancelar trabajo',
    })
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

  // M-4 (revisión de la Tarea 3): el tipo estrecho deja a la web exigir un texto de diálogo
  // para cada acción con motivo en un `Record<ActionRequiringReason, …>` sin caer a un vacío.
  it('requiresReason estrecha el tipo a las acciones con motivo', () => {
    expect(requiresReason('pausar')).toBe(true)
    expect(requiresReason('cancelar')).toBe(true)
    expect(requiresReason('finalizar')).toBe(false)
    expect(requiresReason('aceptar')).toBe(false)
    expectTypeOf<ActionRequiringReason>().toEqualTypeOf<'pausar' | 'cancelar'>()
  })

  // Tarea 5 (Iteración 4): la web abre un diálogo con datos de entrega (mensajero y fecha, o la
  // foto de constancia) para cada acción de este tipo, en un `Record` exhaustivo.
  it('requiresDeliveryForm estrecha el tipo a las acciones con envío o constancia', () => {
    expect(requiresDeliveryForm('marcar_enviado')).toBe(true)
    expect(requiresDeliveryForm('marcar_entregado')).toBe(true)
    expect(requiresDeliveryForm('recibir')).toBe(false)
    expect(requiresDeliveryForm('pausar')).toBe(false)
    expectTypeOf<ActionRequiringDeliveryForm>().toEqualTypeOf<
      'marcar_enviado' | 'marcar_entregado'
    >()
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

  it('ATTACHMENT_DELETE_ROLES es admin y recepción (UX3-16)', () => {
    expect([...ATTACHMENT_DELETE_ROLES].sort()).toEqual(['admin', 'recepcion'])
  })

  it.each([
    ['admin', true],
    ['recepcion', true],
    ['tecnico', false],
    ['mensajero', false],
  ] as const)('canWriteCases(%s) es %s (UX3-16)', (role, expected) => {
    expect(canWriteCases(role)).toBe(expected)
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

describe('STAGE_MOVE_BLOCKED_REASON', () => {
  it('fija el texto de los 409 de fase: última, primera y fase actual indeterminada', () => {
    expect(STAGE_MOVE_BLOCKED_REASON).toEqual({
      ultima:
        'No se puede avanzar: el trabajo ya está en la última fase. Usa "Finalizar" para terminarlo.',
      primera: 'No se puede retroceder: el trabajo ya está en la primera fase.',
      desconocida:
        'No se puede cambiar de fase: no se pudo determinar la fase actual del trabajo. Puede que esté desactivada.',
    })
  })
})

describe('ACTIVE_FOR_DATES_STATUSES / isActiveForDates', () => {
  it('define nuevo, en_proceso, en_espera y en_prueba como los únicos estados con fecha activa (M-2)', () => {
    expect(ACTIVE_FOR_DATES_STATUSES).toEqual(['nuevo', 'en_proceso', 'en_espera', 'en_prueba'])
  })

  it('responde true solo para esos cuatro estados', () => {
    for (const s of CASE_STATUSES) {
      expect(isActiveForDates(s)).toBe(
        s === 'nuevo' || s === 'en_proceso' || s === 'en_espera' || s === 'en_prueba',
      )
    }
  })
})

describe('EN_CURSO_STATUSES / isEnCurso', () => {
  it('define en_proceso, en_espera y en_prueba como los únicos estados "en curso" (vista rápida)', () => {
    expect(EN_CURSO_STATUSES).toEqual(['en_proceso', 'en_espera', 'en_prueba'])
  })

  it('responde true solo para esos tres estados', () => {
    for (const s of CASE_STATUSES) {
      expect(isEnCurso(s)).toBe(s === 'en_proceso' || s === 'en_espera' || s === 'en_prueba')
    }
  })
})

describe('CASE_ACTION_ROLES', () => {
  it('es la unión de los roles de CASE_TRANSITIONS, sin repetidos', () => {
    const union = new Set(Object.values(CASE_TRANSITIONS).flatMap((t) => t.roles))
    expect(new Set(CASE_ACTION_ROLES)).toEqual(union)
    expect(CASE_ACTION_ROLES).toHaveLength(union.size)
  })
})

// UX4-24: el panel de la ficha se llama por lo que toca hacer, no siempre «Producción».
describe('fase del trabajo para el panel de la ficha', () => {
  it('cada estado cae en recogida, producción o entrega', () => {
    expect(CASE_PHASE).toEqual({
      por_recoger: 'recogida',
      nuevo: 'produccion',
      en_proceso: 'produccion',
      en_espera: 'produccion',
      en_prueba: 'produccion',
      terminado: 'entrega',
      enviado: 'entrega',
      entregado: 'entrega',
      cancelado: 'produccion',
    })
  })
  it('títulos del panel por fase', () => {
    expect(CASE_PHASE_TITLE).toEqual({
      recogida: 'Recogida',
      produccion: 'Producción',
      entrega: 'Entrega',
    })
  })
})
