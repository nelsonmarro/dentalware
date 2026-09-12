import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Cada test E2E lleva exactamente un nivel (`docs/conventions.md` §7): el PR corre
 * `@esencial` y `@clave`; `main` corre también `@extendida`. Un test sin etiqueta no
 * correría nunca en el PR sin que nadie lo note, así que aquí se exige.
 */
const E2E_DIR = path.resolve(import.meta.dirname, '../../e2e')
const LEVELS = ['@esencial', '@clave', '@extendida'] as const

function testCalls(source: string): { title: string; head: string }[] {
  const calls: { title: string; head: string }[] = []
  const re = /(?<![.\w])test\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g
  for (const m of source.matchAll(re)) {
    // Solo los argumentos de esta llamada: hasta la flecha de su callback.
    const end = source.indexOf('=>', m.index)
    calls.push({ title: m[2] ?? '', head: source.slice(m.index, end === -1 ? undefined : end) })
  }
  return calls
}

const specs = readdirSync(E2E_DIR).filter((f) => f.endsWith('.spec.ts'))

describe('etiquetas de nivel en los E2E', () => {
  it('hay archivos spec que revisar', () => {
    expect(specs.length).toBeGreaterThan(0)
  })

  for (const spec of specs) {
    it(`${spec}: cada test lleva exactamente una etiqueta de nivel`, () => {
      const source = readFileSync(path.join(E2E_DIR, spec), 'utf8')
      const calls = testCalls(source)
      expect(calls.length).toBeGreaterThan(0)
      for (const { title, head } of calls) {
        const found = LEVELS.filter((level) => head.includes(`tag: '${level}'`))
        expect(
          found,
          `«${title}» debe llevar una etiqueta de nivel (${LEVELS.join(', ')})`,
        ).toHaveLength(1)
      }
    })
  }
})
