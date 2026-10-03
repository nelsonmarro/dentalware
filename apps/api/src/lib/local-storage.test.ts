import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { LocalStorage } from './local-storage.ts'
import { describeStorageContract } from './storage.contract.ts'

describeStorageContract('LocalStorage', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dentalware-storage-'))
  return {
    storage: new LocalStorage(root),
    cleanup: () => rm(root, { recursive: true, force: true }),
  }
})

it('LocalStorage guarda bajo su directorio raíz, con la clave como ruta relativa', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dentalware-storage-'))
  try {
    await new LocalStorage(root).put('trabajos/c1/foto.jpg', new Uint8Array([7]))
    expect(await readFile(join(root, 'trabajos/c1/foto.jpg'))).toEqual(Buffer.from([7]))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
