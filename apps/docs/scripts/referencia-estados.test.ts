import { existsSync, readFileSync } from 'node:fs'
import {
  CASE_ACTION_LABEL,
  CASE_ACTIONS,
  CASE_STATUS_LABEL,
  CASE_STATUSES,
  CASE_TRANSITIONS,
} from '@dentalware/shared'
import { describe, expect, it } from 'vitest'
import { derivarEstados, ESTADOS_JSON } from './referencia-estados'

describe('derivarEstados', () => {
  it('lista todos los estados de CASE_STATUSES con su rótulo, en su orden', () => {
    expect(derivarEstados().estados).toEqual(
      CASE_STATUSES.map((clave) => ({ clave, rotulo: CASE_STATUS_LABEL[clave] })),
    )
  })

  it('cada transición de CASE_TRANSITIONS sale con su rótulo de acción, sus from, su to y sus roles', () => {
    const { transiciones } = derivarEstados()
    expect(transiciones.map((t) => t.accion)).toEqual([...CASE_ACTIONS])
    for (const t of transiciones) {
      const original = CASE_TRANSITIONS[t.accion]
      expect(t).toEqual({
        accion: t.accion,
        rotulo: CASE_ACTION_LABEL[t.accion],
        desde: [...original.from],
        hasta: original.to,
        roles: [...original.roles],
      })
    }
  })

  it('con valores literales: «Recibido» lleva de Por recoger a Nuevo y solo lo marcan admin y recepción', () => {
    const recibir = derivarEstados().transiciones.find((t) => t.accion === 'recibir')
    expect(recibir).toEqual({
      accion: 'recibir',
      rotulo: 'Recibido',
      desde: ['por_recoger'],
      hasta: 'nuevo',
      roles: ['admin', 'recepcion'],
    })
  })
})

const REGENERAR = 'corre `pnpm --filter @dentalware/docs referencia:estados`'

describe('estados.json', () => {
  it('está al día con shared', () => {
    expect(existsSync(ESTADOS_JSON), `falta estados.json: ${REGENERAR}`).toBe(true)
    const escrito: unknown = JSON.parse(readFileSync(ESTADOS_JSON, 'utf8'))
    expect(escrito, `estados.json no coincide con shared: ${REGENERAR}`).toEqual(derivarEstados())
  })
})
