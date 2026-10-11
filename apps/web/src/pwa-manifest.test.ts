import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { INCLUDE_ASSETS, manifest } from './pwa-manifest.ts'

const root = path.resolve(import.meta.dirname, '..')
const pub = (file: string) => path.join(root, 'public', file)

function pngSize(file: string) {
  const buf = readFileSync(pub(file))
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`
}

describe('manifiesto de la PWA', () => {
  it('declara identidad, idioma y modo de pantalla', () => {
    expect(manifest).toMatchObject({
      name: 'Dentalware',
      short_name: 'Dentalware',
      lang: 'es',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      id: '/',
      theme_color: '#0f766e',
    })
  })

  it('trae iconos any de 192 y 512 y un maskable de 512', () => {
    const icons = manifest.icons ?? []
    const has = (sizes: string, purpose: string) =>
      icons.some((i) => i.sizes === sizes && i.purpose === purpose)
    expect(has('192x192', 'any')).toBe(true)
    expect(has('512x512', 'any')).toBe(true)
    expect(has('512x512', 'maskable')).toBe(true)
  })

  it('ningún icono mezcla propósitos', () => {
    for (const icon of manifest.icons ?? []) {
      expect(typeof icon.purpose).toBe('string')
      expect(String(icon.purpose).trim().split(/\s+/)).toHaveLength(1)
    }
  })

  it('cada icono existe y mide lo que dice sizes', () => {
    for (const icon of manifest.icons ?? []) {
      expect(existsSync(pub(icon.src)), icon.src).toBe(true)
      expect(pngSize(icon.src), icon.src).toBe(icon.sizes)
    }
  })

  it('cada includeAssets existe en public', () => {
    for (const file of INCLUDE_ASSETS) expect(existsSync(pub(file)), file).toBe(true)
  })
})

describe('favicon e iconos de Apple', () => {
  it('favicon.ico es un ICO de verdad con varios tamaños', () => {
    const buf = readFileSync(pub('favicon.ico'))
    expect([...buf.subarray(0, 4)]).toEqual([0, 0, 1, 0])
    expect(buf.readUInt16LE(4)).toBeGreaterThanOrEqual(2)
  })

  it('index.html referencia un apple-touch-icon que existe', () => {
    const html = readFileSync(path.join(root, 'index.html'), 'utf8')
    const href = /rel="apple-touch-icon"[^>]*href="([^"]+)"/.exec(html)?.[1]
    expect(href).toBeDefined()
    expect(existsSync(pub((href ?? '').replace(/^\//, '')))).toBe(true)
  })
})
