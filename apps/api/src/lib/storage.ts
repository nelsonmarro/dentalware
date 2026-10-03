import type { Readable } from 'node:stream'

/**
 * Puerto de almacenamiento de archivos (ADR 10, #103). Las features solo conocen esta interfaz;
 * el driver concreto (`LocalStorage` en el MVP, uno S3/R2 en el futuro, #48) lo elige
 * `createStorage` en la raíz de composición según `STORAGE_DRIVER`. Las claves son rutas
 * relativas con `/` (`trabajos/<id>/<uuid>.jpg`), nunca nombres originales ni rutas de disco,
 * así que son válidas tal cual como claves de objeto en la nube. Todo driver cumple el
 * contrato de `storage.contract.ts`.
 */
export interface Storage {
  put(key: string, data: Uint8Array): Promise<void>
  open(key: string): Promise<Readable>
  remove(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}

/**
 * Regla común a todos los drivers: una clave no puede salirse de su espacio (`..`), ser
 * absoluta (`/x`, `C:\x`, `\\servidor`) ni estar vacía. Pura (sin `node:path`) para que la
 * apliquen igual el disco, la nube y el fake de los tests.
 */
export function assertStorageKey(key: string): void {
  const parts = key.split(/[\\/]/)
  const invalid =
    key.length === 0 ||
    key.startsWith('/') ||
    key.startsWith('\\') ||
    /^[A-Za-z]:/.test(key) ||
    parts.includes('..')
  if (invalid) throw new Error(`Clave de almacenamiento inválida: ${key}`)
}
