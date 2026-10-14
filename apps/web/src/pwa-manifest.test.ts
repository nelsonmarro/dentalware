import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { INCLUDE_ASSETS, manifest } from './pwa-manifest.ts'

const root = path.resolve(import.meta.dirname, '..')
const pub = (file: string) => path.join(root, 'public', file)

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

async function cornerAlpha(file: string) {
  const { data } = await sharp(pub(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return data[3] // alfa del píxel (0,0)
}

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
      theme_color: '#F4F6F5',
      background_color: '#F4F6F5',
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

  it('la meta theme-color de index.html coincide con el theme_color del manifiesto', () => {
    const html = readFileSync(path.join(root, 'index.html'), 'utf8')
    const content = /<meta name="theme-color" content="([^"]+)"/.exec(html)?.[1]
    expect(content).toBe(manifest.theme_color)
  })

  it('los iconos PNG empiezan por la firma PNG', () => {
    for (const f of [
      'pwa-192x192.png',
      'pwa-512x512.png',
      'maskable-icon-512x512.png',
      'apple-touch-icon.png',
    ])
      expect([...readFileSync(pub(f)).subarray(0, 8)], f).toEqual(PNG_SIGNATURE)
  })

  it('apple-touch-icon mide 180x180 y es opaco en la esquina', async () => {
    expect(pngSize('apple-touch-icon.png')).toBe('180x180')
    expect(await cornerAlpha('apple-touch-icon.png')).toBe(255)
  })

  it('el maskable es opaco a sangre y el any conserva la esquina transparente', async () => {
    expect(await cornerAlpha('maskable-icon-512x512.png')).toBe(255)
    expect(await cornerAlpha('pwa-512x512.png')).toBe(0)
  })

  it('index.html referencia un apple-touch-icon que existe', () => {
    const html = readFileSync(path.join(root, 'index.html'), 'utf8')
    const href = /rel="apple-touch-icon"[^>]*href="([^"]+)"/.exec(html)?.[1]
    expect(href).toBeDefined()
    expect(existsSync(pub((href ?? '').replace(/^\//, '')))).toBe(true)
  })
})
