import type { PricingUnit } from '@dentalware/shared'

export const PRICING_UNIT_LABEL: Record<PricingUnit, string> = {
  por_pieza: 'Por pieza',
  por_arcada: 'Por arcada',
  por_trabajo: 'Por trabajo',
}

/** Formatea un precio (string o number) como `$ 45.00`. */
export function formatMoney(value: string | number) {
  const n = typeof value === 'number' ? value : Number(value)
  return `$ ${n.toFixed(2)}`
}
