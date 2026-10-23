import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PAGINAS, rutaDeGuia } from './paginas'

const docs = join(import.meta.dirname, '..', 'docs')

function guias(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? guias(p) : /\.mdx?$/.test(f) ? [p] : []
  })
}

describe('rutaDeGuia', () => {
  it('una guía va a su carpeta y su nombre, con barra final', () => {
    expect(rutaDeGuia('recepcion/crear-un-trabajo.md', '# Crear')).toBe(
      '/recepcion/crear-un-trabajo/',
    )
    expect(rutaDeGuia('mensajero/sin-senal.mdx', '')).toBe('/mensajero/sin-senal/')
  })

  it('un index.md es la ruta de su carpeta, y el de la raíz, la portada', () => {
    expect(rutaDeGuia('primeros-pasos/index.md', '')).toBe('/primeros-pasos/')
    expect(rutaDeGuia('index.md', '')).toBe('/')
  })

  it('respeta el slug del frontmatter, absoluto o relativo a la carpeta', () => {
    expect(rutaDeGuia('index.md', '---\ntitle: Bienvenida\nslug: /\n---\n')).toBe('/')
    expect(rutaDeGuia('recepcion/x.md', '---\nslug: /otra/ruta\n---\n')).toBe('/otra/ruta/')
    expect(rutaDeGuia('recepcion/x.md', "---\nslug: 'corta'\n---\n")).toBe('/recepcion/corta/')
  })

  it('un slug fuera del frontmatter no cuenta', () => {
    expect(rutaDeGuia('recepcion/x.md', '---\ntitle: X\n---\n\nslug: /no\n')).toBe('/recepcion/x/')
  })
})

// MAN-2 añadirá guías: una que no esté en `PAGINAS` no la barre nadie.
it('PAGINAS son exactamente las guías de docs/', () => {
  const rutas = guias(docs).map((f) =>
    rutaDeGuia(relative(docs, f).split(sep).join('/'), readFileSync(f, 'utf8')),
  )
  expect([...PAGINAS].sort()).toEqual(rutas.sort())
})
