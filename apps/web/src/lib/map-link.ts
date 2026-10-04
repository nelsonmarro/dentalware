/** El lugar que se busca en el mapa (UX4-21): la dirección en su ciudad («Av. Amazonas N34-56,
 * Quito»), sin repetir la ciudad si la dirección ya la dice. Es también lo que se lee. */
export function mapPlace(address: string, city: string | null): string {
  const c = city?.trim()
  if (!c || address.toLocaleLowerCase('es').includes(c.toLocaleLowerCase('es'))) return address
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
