import { createReadStream } from 'node:fs'
import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Readable } from 'node:stream'
import { assertStorageKey, type Storage } from './storage.ts'

/** Driver del MVP: los archivos viven en el disco del VPS, bajo `UPLOAD_DIR` (#103). */
export class LocalStorage implements Storage {
  private readonly root: string

  constructor(root: string) {
    this.root = root
  }

  private resolve(key: string) {
    assertStorageKey(key)
    return path.join(this.root, key)
  }

  async put(key: string, data: Uint8Array) {
    const file = this.resolve(key)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, data)
  }

  async open(key: string): Promise<Readable> {
    const file = this.resolve(key)
    // Comprobar antes de abrir: `createReadStream` solo falla al leer, y el contrato exige que
    // abrir una clave inexistente falle en `open` igual que en cualquier otro driver.
    await access(file)
    return createReadStream(file)
  }

  async remove(key: string) {
    await rm(this.resolve(key), { force: true })
  }

  async exists(key: string) {
    const file = this.resolve(key)
    try {
      await access(file)
      return true
    } catch {
      return false
    }
  }
}
