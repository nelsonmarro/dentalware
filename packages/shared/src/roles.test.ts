import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_ADMIN_ROLES,
  ACCOUNTS_ROLES,
  CASE_NOTIFY_ROLES,
  hasRole,
  hidesPrices,
  SETTINGS_ROLES,
  TECHNICIAN_FILTER_ROLES,
  USER_ADMIN_ROLES,
  USER_ROLES,
} from './roles.ts'
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

describe('hasRole (UX3-16)', () => {
  it('dice si el rol está en la lista, sin cast en quien lo llama', () => {
    const roles: readonly UserRole[] = ['admin', 'recepcion']
    expect(hasRole(roles, 'recepcion')).toBe(true)
    expect(hasRole(roles, 'tecnico')).toBe(false)
  })
})

describe('constantes de rol de navegación y configuración (Tarea 9, #101)', () => {
  const sorted = (roles: readonly UserRole[]) => [...roles].sort()

  it('solo admin administra usuarios (GET /api/users)', () => {
    expect(sorted(USER_ADMIN_ROLES)).toEqual(['admin'])
  })

  it('solo admin entra a configuración', () => {
    expect(sorted(SETTINGS_ROLES)).toEqual(['admin'])
  })

  it('filtrar trabajos por técnico es solo de admin, porque lee /api/users', () => {
    expect(sorted(TECHNICIAN_FILTER_ROLES)).toEqual(['admin'])
  })

  it('cuentas es de admin y recepción (manejan dinero)', () => {
    expect(sorted(ACCOUNTS_ROLES)).toEqual(['admin', 'recepcion'])
  })

  // Iteración 5 (decisión 7): ajustes y anular pagos son solo del administrador.
  it('ajustes y anulación de pagos son solo de admin', () => {
    expect(sorted(ACCOUNT_ADMIN_ROLES)).toEqual(['admin'])
  })

  it('CASE_NOTIFY_ROLES: admin y recepción avisan a la clínica (AVI-4)', () => {
    expect(CASE_NOTIFY_ROLES).toEqual(['admin', 'recepcion'])
  })
})
