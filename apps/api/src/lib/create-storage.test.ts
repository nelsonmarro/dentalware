import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { createStorage } from './create-storage.ts'
import { LocalStorage } from './local-storage.ts'

it('con STORAGE_DRIVER=local crea un LocalStorage sobre UPLOAD_DIR', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dentalware-storage-'))
  try {
    const storage = createStorage({ STORAGE_DRIVER: 'local', UPLOAD_DIR: root })
    expect(storage).toBeInstanceOf(LocalStorage)
    await storage.put('x.bin', new Uint8Array([5]))
    expect(await readFile(join(root, 'x.bin'))).toEqual(Buffer.from([5]))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
