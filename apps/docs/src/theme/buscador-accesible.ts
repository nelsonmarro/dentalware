/** Nombre accesible en español del buscador (UX8-01): `@easyops-cn/docusaurus-search-local`
 * 0.55.3 escribe `aria-label="Search"` fijo en el campo del navbar y en el de la página de
 * búsqueda; y esa página no tiene `main` (UX8-13). Los wrappers de `SearchBar` y `SearchPage` lo
 * corrigen en el DOM, al montar y ante cada cambio (el teléfono vuelve a montar el campo al
 * abrirlo). Los dos campos conviven en `/search/`: nombres distintos para que la lista de campos
 * de un lector de pantalla no repita el mismo. Idempotente. */
export const ETIQUETA_BUSCADOR = 'Buscar en el manual'
export const ETIQUETA_BUSQUEDA = 'Buscar en el manual: términos'

function etiquetar(raiz: ParentNode, selector: string, etiqueta: string) {
  for (const input of raiz.querySelectorAll<HTMLInputElement>(selector)) {
    if (input.getAttribute('aria-label') !== etiqueta) input.setAttribute('aria-label', etiqueta)
  }
}

export function etiquetarBuscador(raiz: ParentNode): void {
  etiquetar(raiz, 'input.navbar__search-input', ETIQUETA_BUSCADOR)
  etiquetar(raiz, 'input[class*="searchQueryInput"]', ETIQUETA_BUSQUEDA)
  // Con un `main` (o el `role="main"` que ya puso una llamada anterior) no se toca nada: así las
  // llamadas siguientes del observador no reescriben el atributo.
  const documento = raiz.ownerDocument ?? (raiz as Document)
  if (!documento.querySelector('main, [role="main"]')) {
    raiz.querySelector('.container.margin-vert--lg')?.setAttribute('role', 'main')
  }
}
