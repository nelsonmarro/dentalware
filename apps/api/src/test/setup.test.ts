import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cleanupTestStorage } from './setup.ts'

describe('cleanupTestStorage', () => {
  it('borra el directorio temporal de storage de un contexto de test', async () => {
    const storageDir = await mkdtemp(join(tmpdir(), 'dentalware-cleanup-'))
    await writeFile(join(storageDir, 'archivo.txt'), 'contenido')

    await cleanupTestStorage({ storageDir })

    await expect(readFile(join(storageDir, 'archivo.txt'))).rejects.toThrow()
  })
})
