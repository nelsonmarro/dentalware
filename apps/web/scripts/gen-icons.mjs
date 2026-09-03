import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const src = path.join(root, 'public/icon.svg')
const out = path.join(root, 'public')
await mkdir(out, { recursive: true })

const targets = [
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['apple-touch-icon.png', 180],
]
for (const [name, size] of targets) {
  await writeFile(path.join(out, name), await sharp(src).resize(size, size).png().toBuffer())
}
await writeFile(path.join(out, 'favicon.ico'), await sharp(src).resize(48, 48).png().toBuffer())
console.log('iconos generados')
