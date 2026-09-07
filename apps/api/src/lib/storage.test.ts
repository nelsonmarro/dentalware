import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalStorage } from './storage.ts'

describe('LocalStorage', () => {
  let root: string
  let storage: LocalStorage

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dentalware-storage-'))
    storage = new LocalStorage(root)
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('guarda, comprueba existencia, abre y borra un archivo', async () => {
    const data = new Uint8Array([1, 2, 3, 4])
    await storage.put('caso1/foto.jpg', data)

    expect(await storage.exists('caso1/foto.jpg')).toBe(true)

    const readable = await storage.open('caso1/foto.jpg')
    const chunks: Buffer[] = []
    for await (const chunk of readable) chunks.push(chunk as Buffer)
    expect(Buffer.concat(chunks)).toEqual(Buffer.from(data))

    await storage.remove('caso1/foto.jpg')
    expect(await storage.exists('caso1/foto.jpg')).toBe(false)
  })

  it('exists devuelve false para una clave que no existe', async () => {
    expect(await storage.exists('no-existe.jpg')).toBe(false)
  })

  it('rechaza claves con ".."', async () => {
    await expect(storage.put('../fuera.jpg', new Uint8Array())).rejects.toThrow()
  })

  it('rechaza claves absolutas', async () => {
    await expect(storage.put('/etc/fuera.jpg', new Uint8Array())).rejects.toThrow()
  })
})
