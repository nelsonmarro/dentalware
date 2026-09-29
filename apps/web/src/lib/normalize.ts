/** Insensible a mayúsculas y acentos: «Híbrida» → «hibrida». Acepta cualquier valor de celda.
 * Fuente única para el filtro del DataGrid (`components/data-grid`) y del buscador del
 * `Combobox` (`components/combobox.tsx`) — antes era la misma función duplicada en ambos
 * (M-3, ola de fixes del PR 2 de la Iteración 3). */
export function normalize(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}
