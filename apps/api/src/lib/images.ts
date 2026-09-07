import sharp from 'sharp'

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export const isImage = (mime: string) => mime.startsWith('image/')

/** Rota según EXIF, limita a 1600px (sin agrandar) y recodifica a JPEG sin metadatos. */
export async function normalizeImage(input: Uint8Array) {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

/** Miniatura WebP de hasta 320px por lado. */
export function makeThumbnail(input: Uint8Array) {
  return sharp(input)
    .rotate()
    .resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer()
}
