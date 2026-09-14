/** Insensible a mayúsculas y acentos: «Híbrida» → «hibrida». Acepta cualquier valor de celda. */
export function normalize(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}
