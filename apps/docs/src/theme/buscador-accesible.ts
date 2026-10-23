/** Nombre accesible en español del buscador (UX8-01): `@easyops-cn/docusaurus-search-local`
 * 0.55.3 escribe `aria-label="Search"` fijo en el campo del navbar y deja sin nombre el de la
 * página de búsqueda; y esa página no tiene `main` (UX8-13). Los wrappers de `SearchBar` y
 * `SearchPage` lo corrigen en el DOM, al montar y ante cada cambio (el teléfono vuelve a montar el
 * campo al abrirlo). Idempotente. */
export const ETIQUETA_BUSCADOR = 'Buscar en el manual'

export function etiquetarBuscador(raiz: ParentNode): void {
  for (const input of raiz.querySelectorAll<HTMLInputElement>(
    'input.navbar__search-input, input[class*="searchQueryInput"]',
  )) {
    if (input.getAttribute('aria-label') !== ETIQUETA_BUSCADOR)
      input.setAttribute('aria-label', ETIQUETA_BUSCADOR)
  }
  const documento = raiz.ownerDocument ?? (raiz as Document)
  if (!documento.querySelector('main')) {
    raiz.querySelector('.container.margin-vert--lg')?.setAttribute('role', 'main')
  }
}
