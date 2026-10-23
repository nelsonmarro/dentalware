import { toIsoDate } from '@dentalware/shared'

export interface Clock {
  today(): string // YYYY-MM-DD
  now(): Date
}

export const systemClock: Clock = { today: () => toIsoDate(new Date()), now: () => new Date() }

/** Reloj detenido en `iso` (`CLOCK_FIXED_AT`, solo en test): la API, el seed de demostración y
 * el navegador de las capturas del manual ven el mismo instante. `today` usa la zona del proceso,
 * como `systemClock`. */
export function fixedClockAt(iso: string): Clock {
  const at = new Date(iso)
  return { today: () => toIsoDate(at), now: () => new Date(at.getTime()) }
}
