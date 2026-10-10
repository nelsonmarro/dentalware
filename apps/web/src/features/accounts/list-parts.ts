const list = new Intl.ListFormat('es', { type: 'conjunction' })

/**
 * Una enumeración en español con elementos que no son texto (enlaces, monoespaciada): los
 * separadores de `Intl.ListFormat` («, » y « y ») como cadenas y, entre ellos, cada elemento tal
 * cual. Así una lista de React se escribe igual que `list.format` en los avisos.
 */
export function listParts<T>(items: readonly T[]): (T | string)[] {
  return list
    .formatToParts(items.map((_, i) => String(i)))
    .map((p) => (p.type === 'element' ? (items[Number(p.value)] as T) : p.value))
}
