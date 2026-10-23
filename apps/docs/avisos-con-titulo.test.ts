import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = import.meta.dirname

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : /\.mdx?$/.test(f) ? [p] : []
  })
}

/** Avisos (`:::info`, `:::tip`…) sin título propio, como `archivo:línea`. */
function avisosSinTitulo(archivo: string, texto: string): string[] {
  return texto.split('\n').flatMap((linea, i) => {
    const m =
      /^\s*:{3,}(note|tip|info|warning|danger|caution|important|success|secondary)\b(.*)$/.exec(
        linea,
      )
    if (!m) return []
    const titulo = m[2]!
      .trim()
      .replace(/^\[(.*)\]$/, '$1')
      .trim()
    return titulo ? [] : [`${archivo}:${i + 1}`]
  })
}

// UX8-07: los títulos de los avisos no van en mayúsculas, así que uno sin título saldría con el
// rótulo del tema en minúsculas («nota»). Todo aviso lleva el suyo.
describe('avisos del manual', () => {
  it('detecta un aviso sin título, con o sin corchetes', () => {
    expect(avisosSinTitulo('a.md', ':::info\nx\n:::')).toEqual(['a.md:1'])
    expect(avisosSinTitulo('a.md', 'x\n:::tip[]\ny\n:::')).toEqual(['a.md:2'])
    expect(avisosSinTitulo('a.md', ':::info Precios\nx\n:::')).toEqual([])
    expect(avisosSinTitulo('a.md', ':::warning[Importante]\nx\n:::')).toEqual([])
  })

  it('todo aviso de las guías y de la plantilla lleva título propio', () => {
    const archivos = [...walk(join(root, 'docs')), ...walk(join(root, 'plantillas'))]
    expect(archivos.length).toBeGreaterThan(0)
    const sinTitulo = archivos.flatMap((f) =>
      avisosSinTitulo(relative(root, f), readFileSync(f, 'utf8')),
    )
    expect(sinTitulo).toEqual([])
  })
})
