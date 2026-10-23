import type { UserRole } from '@dentalware/shared'
import { test as base } from '@playwright/test'
import { CLOCK_FIXED_AT } from './playwright.config'
import { sesionDe } from './helpers'

/** El `test` de todos los specs de capturas: la sesión del `rol` (por omisión, recepción;
 * `test.use({ rol: 'mensajero' })` para otro) y `Date` fijo en el navegador. */
export const test = base.extend<{ rol: UserRole }>({
  rol: ['recepcion', { option: true }],
  storageState: async ({ rol }, use) => use(sesionDe(rol)),
  page: async ({ page }, use) => {
    // `Date` fijo en el navegador (los temporizadores siguen): «a las 10:30», «hoy», «martes 20».
    await page.clock.setFixedTime(new Date(CLOCK_FIXED_AT))
    await use(page)
  },
})
export { expect } from '@playwright/test'
