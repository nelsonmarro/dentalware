import { afterEach, describe, expect, it, vi } from 'vitest'
import { compressImage } from './image-compress'

describe('compressImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('con un archivo que no es imagen devuelve el mismo objeto', async () => {
    const file = new File(['hola'], 'notas.txt', { type: 'text/plain' })
    const result = await compressImage(file)
    expect(result).toBe(file)
  })

  it('sin soporte de createImageBitmap devuelve el archivo original', async () => {
    const file = new File(['x'], 'foto.png', { type: 'image/png' })
    const result = await compressImage(file)
    expect(result).toBe(file)
  })

  it('con createImageBitmap disponible comprime a un Blob jpeg pidiendo un canvas de ≤ 1600 px', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 3000, height: 2000, close: vi.fn() }),
    )
    let requestedWidth = 0
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      requestedWidth = this.width
      callback(new Blob(['img'], { type: 'image/jpeg' }))
    })

    const file = new File(['x'], 'foto.png', { type: 'image/png' })
    const result = await compressImage(file, 1600, 0.82)

    expect(result.type).toBe('image/jpeg')
    expect(requestedWidth).toBeLessThanOrEqual(1600)
  })
})
