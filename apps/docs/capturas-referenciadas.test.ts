import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = import.meta.dirname

function walk(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p, ext) : ext.test(f) ? [p] : []
  })
}

/** Nombres que declaran los specs: cada `captura(page, '<seccion>/<nombre>'`. */
function nombresEnSpecs(): Set<string> {
  const out = new Set<string>()
  for (const f of walk(join(root, 'capturas'), /\.spec\.ts$/)) {
    for (const m of readFileSync(f, 'utf8').matchAll(/captura\(\s*page,\s*'([^']+)'/g)) {
      out.add(m[1]!)
    }
  }
  return out
}

/** Nombres que usan los MDX: `<Captura nombre="<seccion>/<nombre>"`. */
function nombresEnDocs(): Set<string> {
  const out = new Set<string>()
  for (const f of walk(join(root, 'docs'), /\.mdx?$/)) {
    for (const m of readFileSync(f, 'utf8').matchAll(/<Captura\s[^>]*nombre="([^"]+)"/g)) {
      out.add(m[1]!)
    }
  }
  return out
}

describe('capturas referenciadas', () => {
  it('toda captura que usa una guía la produce un spec', () => {
    const specs = nombresEnSpecs()
    const faltan = [...nombresEnDocs()].filter((n) => !specs.has(n))
    expect(faltan).toEqual([])
  })
  it('toda captura que produce un spec la usa alguna guía (ninguna huérfana)', () => {
    const docs = nombresEnDocs()
    const huerfanas = [...nombresEnSpecs()].filter((n) => !docs.has(n))
    expect(huerfanas).toEqual([])
  })
  it('hay al menos una captura declarada', () => {
    expect(nombresEnSpecs().size).toBeGreaterThan(0)
  })
})

describe('reloj fijo de las capturas', () => {
  // El instante vive en tres sitios (seed, Playwright y el guion del modo rápido): si uno cambia
  // y los otros no, las fechas del seed y las del navegador dejan de coincidir.
  it('seed-demo-data.ts, playwright.config.ts y capturas-servidores.sh llevan el mismo instante', () => {
    const instante = /2026-10-20T10:30:00-05:00/
    for (const f of [
      join(root, '..', 'api', 'src', 'scripts', 'seed-demo-data.ts'),
      join(root, 'capturas', 'playwright.config.ts'),
      join(root, 'scripts', 'capturas-servidores.sh'),
    ]) {
      expect(readFileSync(f, 'utf8'), f).toMatch(instante)
    }
  })
})
