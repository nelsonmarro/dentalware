/**
 * Comprime una imagen en el navegador antes de subirla: la reescala a `maxSide` px por
 * su lado mayor y la recodifica a JPEG con `quality`. Si el archivo no es una imagen o
 * el navegador no soporta `createImageBitmap`, devuelve el archivo original sin tocar
 * (por ejemplo PDFs, o navegadores viejos): nunca bloquea la subida.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  // jsdom (pruebas) no implementa el contexto 2D: se omite el dibujo con seguridad y se
  // deja que `toBlob` (mockeado en las pruebas) resuelva igual.
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality)
  })
  return blob ?? file
}
