import sharp from 'sharp'
import type { ImageProcessor } from '../features/attachments/ports.ts'

// Reexportado por compatibilidad (attachments/routes.ts y tests existentes); la política
// vive en upload-policy.ts, que no importa `sharp` (docs/architecture.md §3.5 I-1).
export { ALLOWED_MIME, MAX_UPLOAD_BYTES, isImage } from './upload-policy.ts'

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

/** Adaptador del puerto `ImageProcessor` (features/attachments/ports.ts) sobre `sharp`. */
export const sharpImages: ImageProcessor = {
  normalize: normalizeImage,
  thumbnail: makeThumbnail,
}
