import { describe, expect, it } from 'vitest'
import {
  AttachmentNotFoundError,
  CaseNotFoundError,
  FileTooLargeError,
  UnsupportedFileError,
} from './errors.ts'
import {
  casesQueryWith,
  fakeAttachmentsRepo,
  fakeImages,
  fixedIds,
  memoryStorage,
  recordingEvents,
} from './fakes.ts'
import { createAttachmentsService } from './service.ts'
import type { UploadInput } from './ports.ts'

const admin = { userId: 'u1', role: 'admin' } as const

function build(ids: string[] = ['id-1']) {
  const attachments = fakeAttachmentsRepo()
  const cases = casesQueryWith(['c1'])
  const { log: events, events: eventLog } = recordingEvents()
  const storage = memoryStorage()
  const service = createAttachmentsService({
    attachments,
    cases,
    events,
    storage,
    images: fakeImages,
    ids: fixedIds(ids),
  })
  return { service, storage, eventLog }
}

function bytes(str: string) {
  return new TextEncoder().encode(str)
}

function uploadOf(over: Partial<UploadInput> = {}): UploadInput {
  const raw = bytes('contenido')
  return {
    caseId: 'c1',
    filename: 'foto.jpg',
    mime: 'image/jpeg',
    size: raw.byteLength,
    bytes: raw,
    kind: null,
    ...over,
  }
}

describe('createAttachmentsService', () => {
  it('sube una imagen: normaliza, guarda miniatura y original, registra attachment_added', async () => {
    const { service, storage, eventLog } = build()

    const row = await service.upload(uploadOf(), admin)

    expect(row.kind).toBe('photo')
    expect(row.mime).toBe('image/jpeg')
    expect(row.width).toBe(100)
    expect(row.height).toBe(80)
    expect(await storage.exists('c1/id-1.jpg')).toBe(true)
    expect(await storage.exists('c1/id-1.thumb.webp')).toBe(true)
    expect(eventLog).toContainEqual(
      expect.objectContaining({ caseId: 'c1', type: 'attachment_added', toValue: 'foto.jpg' }),
    )
  })

  it('sube un PDF válido como documento', async () => {
    const { service } = build()
    const pdf = new TextEncoder().encode('%PDF-1.4\ncontenido')

    const row = await service.upload(
      uploadOf({ filename: 'doc.pdf', mime: 'application/pdf', size: pdf.byteLength, bytes: pdf }),
      admin,
    )

    expect(row.kind).toBe('document')
    expect(row.mime).toBe('application/pdf')
  })

  it('rechaza un PDF sin cabecera %PDF- con UnsupportedFileError', async () => {
    const { service } = build()
    const notPdf = bytes('esto no es un pdf')

    await expect(
      service.upload(
        uploadOf({
          filename: 'falso.pdf',
          mime: 'application/pdf',
          size: notPdf.byteLength,
          bytes: notPdf,
        }),
        admin,
      ),
    ).rejects.toBeInstanceOf(UnsupportedFileError)
  })

  it('rechaza un MIME no permitido', async () => {
    const { service } = build()
    const txt = bytes('hola')

    await expect(
      service.upload(
        uploadOf({ filename: 'nota.txt', mime: 'text/plain', size: txt.byteLength, bytes: txt }),
        admin,
      ),
    ).rejects.toBeInstanceOf(UnsupportedFileError)
  })

  it('rechaza un archivo mayor que el límite con FileTooLargeError', async () => {
    const { service } = build()

    await expect(
      service.upload(uploadOf({ size: 26 * 1024 * 1024 }), admin),
    ).rejects.toBeInstanceOf(FileTooLargeError)
  })

  it('lanza CaseNotFoundError si el trabajo no existe', async () => {
    const { service } = build()

    await expect(service.upload(uploadOf({ caseId: 'nope' }), admin)).rejects.toBeInstanceOf(
      CaseNotFoundError,
    )
  })

  it('rechaza una imagen corrupta (falla la normalización) con UnsupportedFileError', async () => {
    const { service } = build()
    const corrupt = new Uint8Array([0x00, 1, 2, 3])

    await expect(
      service.upload(uploadOf({ size: corrupt.byteLength, bytes: corrupt }), admin),
    ).rejects.toBeInstanceOf(UnsupportedFileError)
  })

  it('al borrar elimina archivo, miniatura y registra attachment_removed', async () => {
    const { service, storage, eventLog } = build()
    const row = await service.upload(uploadOf(), admin)

    await service.remove(row.id, admin)

    expect(await storage.exists('c1/id-1.jpg')).toBe(false)
    expect(await storage.exists('c1/id-1.thumb.webp')).toBe(false)
    expect(eventLog).toContainEqual(
      expect.objectContaining({ caseId: 'c1', type: 'attachment_removed', fromValue: 'foto.jpg' }),
    )
  })

  it('borrar un adjunto inexistente lanza AttachmentNotFoundError', async () => {
    const { service } = build()

    await expect(service.remove('nope', admin)).rejects.toBeInstanceOf(AttachmentNotFoundError)
  })

  it('open devuelve mime y nombre del adjunto', async () => {
    const { service } = build()
    const row = await service.upload(uploadOf(), admin)

    const opened = await service.open(row.id)

    expect(opened.mime).toBe('image/jpeg')
    expect(opened.filename).toBe('foto.jpg')
  })

  it('open lanza AttachmentNotFoundError si el adjunto no existe', async () => {
    const { service } = build()

    await expect(service.open('nope')).rejects.toBeInstanceOf(AttachmentNotFoundError)
  })

  it('openThumbnail lanza si no hay miniatura', async () => {
    const { service } = build()
    const pdf = new TextEncoder().encode('%PDF-1.4\ncontenido')
    const row = await service.upload(
      uploadOf({ filename: 'doc.pdf', mime: 'application/pdf', size: pdf.byteLength, bytes: pdf }),
      admin,
    )

    await expect(service.openThumbnail(row.id)).rejects.toBeInstanceOf(AttachmentNotFoundError)
  })

  it('lista solo devuelve los adjuntos del trabajo', async () => {
    const { service } = build(['id-1', 'id-2'])
    await service.upload(uploadOf(), admin)
    await service.upload(uploadOf({ caseId: 'c1', filename: 'foto2.jpg' }), admin)

    const list = await service.list('c1')

    expect(list).toHaveLength(2)
  })
})
