import { describe, expect, it } from 'vitest'
import { etiquetarBuscador } from './buscador-accesible'

function dom(html: string) {
  document.body.innerHTML = html
  return document.body
}

describe('etiquetarBuscador', () => {
  it('nombra en español el campo del navbar, que el plugin deja en «Search»', () => {
    const raiz = dom(
      '<input class="navbar__search-input" aria-label="Search" placeholder="Buscar">',
    )
    etiquetarBuscador(raiz)
    expect(raiz.querySelector('input')).toHaveAttribute('aria-label', 'Buscar en el manual')
  })

  it('nombra el campo de la página de búsqueda', () => {
    const raiz = dom('<input class="searchQueryInput_abc" placeholder="Buscar">')
    etiquetarBuscador(raiz)
    expect(raiz.querySelector('input')).toHaveAttribute('aria-label', 'Buscar en el manual')
  })

  it('marca como main el contenedor de resultados si la página no tiene ninguno', () => {
    const raiz = dom('<div class="container margin-vert--lg"><h1>Buscar</h1></div>')
    etiquetarBuscador(raiz)
    expect(raiz.querySelector('.container')).toHaveAttribute('role', 'main')
  })

  it('no añade un segundo main si ya hay uno', () => {
    const raiz = dom('<main></main><div class="container margin-vert--lg"></div>')
    etiquetarBuscador(raiz)
    expect(raiz.querySelector('.container')).not.toHaveAttribute('role')
  })

  it('es idempotente y no toca otros campos', () => {
    const raiz = dom('<input class="navbar__search-input"><input aria-label="Otro">')
    etiquetarBuscador(raiz)
    etiquetarBuscador(raiz)
    expect(raiz.querySelector('[aria-label="Otro"]')).toBeInTheDocument()
    expect(raiz.querySelectorAll('[aria-label="Buscar en el manual"]')).toHaveLength(1)
  })
})
