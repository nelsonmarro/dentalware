/** Formatea un precio (string o number) como `$ 45.00`. */
export function formatMoney(value: string | number) {
  const n = typeof value === 'number' ? value : Number(value)
  return `$ ${n.toFixed(2)}`
}
