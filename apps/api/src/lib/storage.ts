import { createReadStream } from 'node:fs'
import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Readable } from 'node:stream'

export interface Storage {
  put(key: string, data: Uint8Array): Promise<void>
  open(key: string): Promise<Readable>
  remove(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}

export class LocalStorage implements Storage {
  private readonly root: string

  constructor(root: string) {
    this.root = root
  }

  private resolve(key: string) {
    if (path.isAbsolute(key) || key.split(/[\\/]/).includes('..')) {
      throw new Error(`Clave de almacenamiento inválida: ${key}`)
    }
    return path.join(this.root, key)
  }

  async put(key: string, data: Uint8Array) {
    const file = this.resolve(key)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, data)
  }

  async open(key: string) {
    return createReadStream(this.resolve(key))
  }

  async remove(key: string) {
    await rm(this.resolve(key), { force: true })
  }

  async exists(key: string) {
    try {
      await access(this.resolve(key))
      return true
    } catch {
      return false
    }
  }
}
