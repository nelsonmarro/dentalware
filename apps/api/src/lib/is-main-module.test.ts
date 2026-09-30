import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { isMainModule } from './is-main-module.ts'

/**
 * `seed.ts`/`reset-test-db.ts` solo corren su `main()` cuando el proceso los ejecutó como
 * script, no cuando un test los importa. La comparación ingenua
 * `fileURLToPath(import.meta.url) === process.argv[1]` falla si se arrancó por un symlink
 * (`process.argv[1]` es la ruta del symlink, no la ruta real del archivo): el proceso sale con
 * código 0 sin imprimir nada y el script nunca corre (issue #21, ronda de fixes 1, M-3).
 */
describe('isMainModule', () => {
  const originalArgv1 = process.argv[1]
  let tmpDir: string | undefined

  afterEach(() => {
    process.argv[1] = originalArgv1
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
    tmpDir = undefined
  })

  it('es true cuando process.argv[1] es la ruta real del módulo', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'dentalware-main-module-'))
    const real = join(tmpDir, 'script.ts')
    writeFileSync(real, '')
    process.argv[1] = real

    expect(isMainModule(pathToFileURL(real).href)).toBe(true)
  })

  it('es true cuando process.argv[1] es un symlink al módulo (arranque por symlink)', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'dentalware-main-module-'))
    const real = join(tmpDir, 'script.ts')
    const link = join(tmpDir, 'script-symlink.ts')
    writeFileSync(real, '')
    symlinkSync(real, link)
    process.argv[1] = link

    expect(isMainModule(pathToFileURL(real).href)).toBe(true)
  })

  it('es false cuando process.argv[1] es otro archivo', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'dentalware-main-module-'))
    const real = join(tmpDir, 'script.ts')
    const other = join(tmpDir, 'otro.ts')
    writeFileSync(real, '')
    writeFileSync(other, '')
    process.argv[1] = other

    expect(isMainModule(pathToFileURL(real).href)).toBe(false)
  })

  it('es false cuando no hay process.argv[1] (módulo importado, no ejecutado)', () => {
    process.argv[1] = undefined as unknown as string
    delete (process.argv as (string | undefined)[])[1]

    expect(isMainModule(pathToFileURL('/no/importa.ts').href)).toBe(false)
  })
})
