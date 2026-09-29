import { describe, expect, it } from 'vitest'
import { hidesPrices, USER_ROLES } from './roles.ts'
import type { UserRole } from './roles.ts'

describe('hidesPrices', () => {
  it('oculta precios a técnico y mensajero', () => {
    expect(hidesPrices('tecnico')).toBe(true)
    expect(hidesPrices('mensajero')).toBe(true)
  })

  it('muestra precios a admin y recepción', () => {
    expect(hidesPrices('admin')).toBe(false)
    expect(hidesPrices('recepcion')).toBe(false)
  })

  it('es exhaustivo: cada rol de USER_ROLES tiene una decisión', () => {
    const decisions = USER_ROLES.map((role: UserRole) => hidesPrices(role))
    expect(decisions).toHaveLength(USER_ROLES.length)
  })
})
