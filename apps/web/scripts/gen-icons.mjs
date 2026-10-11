import { mkdir, writeFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const src = path.join(root, 'public/icon.svg')
const out = path.join(root, 'public')
const BRAND = '#0f766e'
await mkdir(out, { recursive: true })

const png = (size) => sharp(src).resize(size, size).png().toBuffer()

for (const [name, size] of [
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  await writeFile(path.join(out, name), await png(size))
}

// Maskable: fondo a sangre y el logo dentro de la zona segura (80 % central).
const inner = await sharp(src).resize(410, 410).png().toBuffer()
await writeFile(
  path.join(out, 'maskable-icon-512x512.png'),
  await sharp({ create: { width: 512, height: 512, channels: 4, background: BRAND } })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toBuffer(),
)

// favicon.ico de verdad: cabecera ICO con PNG incrustados de 16, 32 y 48 px.
const sizes = [16, 32, 48]
const images = await Promise.all(sizes.map(png))
const header = Buffer.alloc(6)
header.writeUInt16LE(1, 2) // tipo: icono
header.writeUInt16LE(sizes.length, 4)
let offset = header.length + 16 * sizes.length
const entries = images.map((img, i) => {
  const e = Buffer.alloc(16)
  e.writeUInt8(sizes[i], 0)
  e.writeUInt8(sizes[i], 1)
  e.writeUInt16LE(1, 4) // planos
  e.writeUInt16LE(32, 6) // bits por pixel
  e.writeUInt32LE(img.length, 8)
  e.writeUInt32LE(offset, 12)
  offset += img.length
  return e
})
await writeFile(path.join(out, 'favicon.ico'), Buffer.concat([header, ...entries, ...images]))
console.log('iconos generados')
