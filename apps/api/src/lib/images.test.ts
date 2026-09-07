import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { makeThumbnail, normalizeImage } from './images.ts'

async function fixtureJpeg(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: '#0f766e' } })
    .jpeg()
    .toBuffer()
}
async function fixturePng(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: '#0f766e' } })
    .png()
    .toBuffer()
}

describe('normalizeImage', () => {
  it('reduce una imagen grande a un ancho máximo de 1600 y la deja en JPEG', async () => {
    const input = await fixtureJpeg(3000, 2000)

    const { data, width, height } = await normalizeImage(input)

    expect(width).toBeLessThanOrEqual(1600)
    expect(height).toBeLessThanOrEqual(1600)
    const meta = await sharp(data).metadata()
    expect(meta.format).toBe('jpeg')
  })

  it('no agranda una imagen pequeña', async () => {
    const input = await fixturePng(100, 80)

    const { width, height } = await normalizeImage(input)

    expect(width).toBe(100)
    expect(height).toBe(80)
  })
})

describe('makeThumbnail', () => {
  it('genera una miniatura WebP de hasta 320px', async () => {
    const input = await fixtureJpeg(3000, 2000)

    const thumb = await makeThumbnail(input)

    const meta = await sharp(thumb).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBeLessThanOrEqual(320)
    expect(meta.height).toBeLessThanOrEqual(320)
  })
})
