import { Readable } from 'node:stream'
import type { IdGenerator } from '../../lib/ids.ts'
import type { Storage } from '../../lib/storage.ts'
import type {
  AttachmentRecord,
  AttachmentsRepository,
  CaseEventLog,
  CasesQuery,
  ImageProcessor,
  NewAttachment,
} from './ports.ts'

/** Almacenamiento en memoria: suficiente para probar el flujo sin disco. */
export function memoryStorage(): Storage {
  const files = new Map<string, Uint8Array>()
  return {
    async put(key, data) {
      files.set(key, data)
    },
    async open(key) {
      const data = files.get(key)
      if (!data) throw new Error(`No existe en el storage: ${key}`)
      return Readable.from(Buffer.from(data))
    },
    async remove(key) {
      files.delete(key)
    },
    async exists(key) {
      return files.has(key)
    },
  }
}

/**
 * Procesador de imágenes falso: `normalize` lanza cuando el primer byte es `0x00`, para
 * simular una imagen corrupta sin depender de `sharp`; `thumbnail` devuelve un recorte
 * corto de la entrada (suficiente para comprobar que se guarda algo).
 */
export const fakeImages: ImageProcessor = {
  async normalize(input) {
    if (input[0] === 0x00) throw new Error('no es imagen')
    return { data: input, width: 100, height: 80 }
  },
  async thumbnail(input) {
    return input.subarray(0, 8)
  },
}

export const fixedIds = (ids: string[]): IdGenerator => {
  let i = 0
  return {
    next: () => {
      const id = ids[i]
      i += 1
      return id ?? `id-extra-${i}`
    },
  }
}

/** Repositorio en memoria: suficiente para probar orquestación y errores. */
export function fakeAttachmentsRepo(seed: AttachmentRecord[] = []): AttachmentsRepository {
  const rows = new Map(seed.map((r) => [r.id, r]))
  return {
    async insert(row: NewAttachment) {
      const record: AttachmentRecord = {
        id: row.id,
        caseId: row.caseId,
        kind: row.kind,
        filename: row.filename,
        mime: row.mime,
        size: row.size,
        width: row.width ?? null,
        height: row.height ?? null,
        storagePath: row.storagePath,
        thumbPath: row.thumbPath ?? null,
        uploadedBy: row.uploadedBy,
        createdAt: new Date(),
        uploader: { id: row.uploadedBy, name: 'Actor' },
      }
      rows.set(record.id, record)
      return record
    },
    async byId(id) {
      return rows.get(id)
    },
    async byCase(caseId) {
      return [...rows.values()].filter((r) => r.caseId === caseId)
    },
    async remove(id) {
      rows.delete(id)
    },
  }
}

export const casesQueryWith = (existingIds: string[]): CasesQuery => ({
  exists: async (caseId) => existingIds.includes(caseId),
})

export function recordingEvents() {
  const events: Parameters<CaseEventLog['add']>[0][] = []
  const log: CaseEventLog = {
    async add(e) {
      events.push(e)
    },
  }
  return { log, events }
}
