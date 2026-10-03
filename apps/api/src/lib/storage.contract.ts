import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Storage } from './storage.ts'

async function readAll(storage: Storage, key: string): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of await storage.open(key)) chunks.push(Buffer.from(chunk as Uint8Array))
  return Buffer.concat(chunks)
}

/**
 * Contrato del puerto `Storage` (#103): lo que cualquier driver debe cumplir para que las
 * features no noten el cambio. Hoy lo pasan `LocalStorage` y el fake en memoria; un driver de
 * la nube (S3/R2, #48) se da por bueno cuando pasa esta misma suite.
 */
export function describeStorageContract(
  name: string,
  make: () => Promise<{ storage: Storage; cleanup?: () => Promise<void> }>,
) {
  describe(`contrato de Storage: ${name}`, () => {
    let storage: Storage
    let cleanup: (() => Promise<void>) | undefined

    beforeEach(async () => {
      ;({ storage, cleanup } = await make())
    })
    afterEach(async () => {
      await cleanup?.()
    })

    it('guarda y devuelve los mismos bytes por su clave', async () => {
      await storage.put('trabajos/c1/foto.jpg', new Uint8Array([1, 2, 3, 4]))

      expect(await storage.exists('trabajos/c1/foto.jpg')).toBe(true)
      expect(await readAll(storage, 'trabajos/c1/foto.jpg')).toEqual(Buffer.from([1, 2, 3, 4]))
    })

    it('guardar otra vez en la misma clave la sobrescribe', async () => {
      await storage.put('a.bin', new Uint8Array([1, 1, 1]))
      await storage.put('a.bin', new Uint8Array([2]))

      expect(await readAll(storage, 'a.bin')).toEqual(Buffer.from([2]))
    })

    it('exists es false para una clave que nunca se guardó', async () => {
      expect(await storage.exists('no-existe.jpg')).toBe(false)
    })

    it('abrir una clave inexistente falla en el propio open, no al leer', async () => {
      await expect(storage.open('no-existe.jpg')).rejects.toThrow()
    })

    it('borrar quita el archivo, y borrar uno que no existe no falla', async () => {
      await storage.put('b.bin', new Uint8Array([9]))
      await storage.remove('b.bin')

      expect(await storage.exists('b.bin')).toBe(false)
      await expect(storage.remove('b.bin')).resolves.toBeUndefined()
    })

    it.each(['../fuera.jpg', 'a/../../fuera.jpg', '/etc/fuera.jpg', '..\\fuera.jpg', ''])(
      'rechaza la clave inválida %j en todas las operaciones',
      async (key) => {
        await expect(storage.put(key, new Uint8Array([1]))).rejects.toThrow()
        await expect(storage.open(key)).rejects.toThrow()
        await expect(storage.remove(key)).rejects.toThrow()
        await expect(storage.exists(key)).rejects.toThrow()
      },
    )
  })
}
