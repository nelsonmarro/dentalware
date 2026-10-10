import type { AdjustableCase } from './adjustment-dialog'

/**
 * Los trabajos a los que se puede ligar un ajuste (CTA-3): los que cargan a la cuenta, que son
 * los que tienen un movimiento «Cargo» (`entregado` o `cobrado`), cada uno una vez y por código.
 * Lo que debe y lo pagado salen de «Por cobrar»; si no está ahí, ya está cobrado (`null`).
 */
export function adjustableCases(
  movements: readonly { kind: string; case: { id: string; code: string } | null }[],
  open: readonly { id: string; outstanding: string; allocated: string }[],
): AdjustableCase[] {
  const seen = new Map<string, AdjustableCase>()
  for (const m of movements) {
    if (m.kind !== 'cargo' || !m.case || seen.has(m.case.id)) continue
    const o = open.find((c) => c.id === m.case?.id)
    seen.set(m.case.id, {
      id: m.case.id,
      code: m.case.code,
      outstanding: o?.outstanding ?? null,
      allocated: o?.allocated ?? null,
    })
  }
  return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code))
}
