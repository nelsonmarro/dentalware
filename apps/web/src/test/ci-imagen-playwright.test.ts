import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * El job `e2e` del CI corre en la imagen oficial de Playwright (#141): trae Chromium y WebKit
 * con sus librerías, así que no depende del mirror apt del runner. La imagen lleva la versión
 * en el nombre y no puede leerla del catalog (`jobs.<id>.container.image` no admite `env`),
 * así que aquí se exige que coincida con la que fija `pnpm-workspace.yaml`; el guion local
 * `scripts/e2e-iphone.sh` ya la deriva del paquete instalado.
 */
const ROOT = path.resolve(import.meta.dirname, '../../../..')
const ci = readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8')
const workspace = readFileSync(path.join(ROOT, 'pnpm-workspace.yaml'), 'utf8')

describe('imagen de Playwright del job e2e', () => {
  const version = /'@playwright\/test': (\d+\.\d+\.\d+)/.exec(workspace)?.[1]

  it('el catalog fija la versión de @playwright/test', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('el job e2e corre en mcr.microsoft.com/playwright con esa misma versión', () => {
    const imagenes = [
      ...ci.matchAll(/image: mcr\.microsoft\.com\/playwright:v([\d.]+)-noble/g),
    ].map((m) => m[1])
    expect(imagenes).toEqual([version])
  })

  it('el job e2e ya no instala navegadores ni sus librerías con apt', () => {
    expect(ci).not.toMatch(/playwright install(-deps)?\b/)
  })
})
