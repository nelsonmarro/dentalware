import type { Config } from '../config.ts'
import { LocalStorage } from './local-storage.ts'
import type { Storage } from './storage.ts'

type StorageConfig = Pick<Config, 'STORAGE_DRIVER' | 'UPLOAD_DIR'>

/**
 * Un constructor por driver, en un `Record` exhaustivo sobre `STORAGE_DRIVER` (#103): añadir
 * `'s3'` al enum de `config.ts` no compila hasta que exista su entrada aquí. Es el único sitio
 * que cambia para pasar a la nube (#48): ninguna feature importa un driver concreto.
 */
const DRIVERS: Record<Config['STORAGE_DRIVER'], (config: StorageConfig) => Storage> = {
  local: (config) => new LocalStorage(config.UPLOAD_DIR),
}

export function createStorage(config: StorageConfig): Storage {
  return DRIVERS[config.STORAGE_DRIVER](config)
}
