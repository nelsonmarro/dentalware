/** Enlace a la dirección de la clínica en Google Maps (ENT-5): la URL de búsqueda universal
 * abre la app de mapas en el celular y la web en el escritorio. `encodeURIComponent` codifica
 * tildes, comas y el `#` de «Edif. #3», que de otro modo cortaría la consulta. */
export function mapUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

/** Enlace para llamar a la clínica: `tel:` con el número sin espacios (como se guarda en la
 * ficha de la clínica, «099 123 4567»). */
export function telUrl(phone: string): string {
  return `tel:${phone.replace(/\s+/g, '')}`
}
