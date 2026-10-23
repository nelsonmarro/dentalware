import { existsSync } from 'node:fs'
import type { UserRole } from '@dentalware/shared'
import { chromium, type FullConfig } from '@playwright/test'
import { guardarSesion, sesionDe } from './helpers'

const ROLES = ['admin', 'recepcion', 'tecnico', 'mensajero'] as const satisfies readonly UserRole[]

/** Una sesión por rol (`.auth/<rol>.json`) antes de las capturas. */
export default async function globalSetup(config: FullConfig) {
  // Modo rápido con las cuatro sesiones ya guardadas: no se vuelve a entrar.
  if (process.env.CAPTURAS_RAPIDO === '1' && ROLES.every((r) => existsSync(sesionDe(r)))) return
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:5173'
  const browser = await chromium.launch()
  try {
    for (const rol of ROLES) await guardarSesion(browser, rol, baseURL)
  } finally {
    await browser.close()
  }
}
