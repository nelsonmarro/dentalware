const sameText = (a: string, b: string) =>
  a.trim().localeCompare(b.trim(), 'es', { sensitivity: 'base' }) === 0

/** El lugar que se busca en el mapa (UX4-21): la dirección en su ciudad («Av. Amazonas N34-56,
 * Quito»), sin repetir la ciudad si la dirección ya acaba en ella. Se mira solo el último tramo
 * tras la coma (M-3, revisión T9): «Av. Loja 12» en Loja sí necesita la ciudad. Es también lo
 * que se lee. */
export function mapPlace(address: string, city: string | null): string {
  const c = city?.trim()
  const last = address.split(',').at(-1) ?? ''
  if (!c || sameText(last, c)) return address
  return `${address}, ${c}`
}

/** Enlace a la dirección de la clínica en Google Maps (ENT-5): la URL de búsqueda universal
 * abre la app de mapas en el celular y la web en el escritorio. Con la ciudad (UX4-21): «Av.
 * Amazonas N34-56» a secas puede caer en otra ciudad. `encodeURIComponent` codifica tildes,
 * comas y el `#` de «Edif. #3», que de otro modo cortaría la consulta. */
export function mapUrl(address: string, city: string | null = null): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapPlace(address, city))}`
}

/** Enlace para llamar a la clínica: `tel:` con el número sin espacios (como se guarda en la
 * ficha de la clínica, «099 123 4567»). */
export function telUrl(phone: string): string {
  return `tel:${phone.replace(/\s+/g, '')}`
}

/** Enlace `wa.me` (AVI-4): el número en E.164 sin `+` y el texto codificado. No envía nada. */
export function whatsappUrl(e164: string, text: string): string {
  return `https://wa.me/${e164.replace(/^\+/, '')}?text=${encodeURIComponent(text)}`
}
