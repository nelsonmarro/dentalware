import { describe, expect, it } from 'vitest'
import { DELIVERY_PROOF_LOCKED_MESSAGE } from '@dentalware/shared'
import {
  AttachmentForbiddenError,
  AttachmentInUseError,
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
  pendingDeliveriesWith,
  recordingEvents,
} from './fakes.ts'
import { createAttachmentsService } from './service.ts'
import type { UploadInput } from './ports.ts'

const admin = { userId: 'u1', role: 'admin' } as const
const tecnico = { userId: 'u2', role: 'tecnico' } as const
const mensajero = { userId: 'u3', role: 'mensajero' } as const
const recepcion = { userId: 'u4', role: 'recepcion' } as const
const otroMensajero = { userId: 'u5', role: 'mensajero' } as const

type PendingSeed = Parameters<typeof pendingDeliveriesWith>[0]
type ProofSeed = Parameters<typeof pendingDeliveriesWith>[1]

function build(ids: string[] = ['id-1'], pending: PendingSeed = [], proofs: ProofSeed = []) {
  const attachments = fakeAttachmentsRepo()
  const cases = casesQueryWith(['c1'])
  const { log: events, events: eventLog } = recordingEvents()
  const storage = memoryStorage()
  const service = createAttachmentsService({
    attachments,
    cases,
    events,
    deliveries: pendingDeliveriesWith(pending, proofs),
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

  // UX4-06: la constancia que cerró una entrega se distingue de una sin usar y no se borra.
  describe('constancia ligada a una entrega', () => {
    const constancia = { kind: 'constancia' as const, filename: 'constancia.jpg' }

    it('la lista marca como ligada solo la constancia que referencia una entrega hecha', async () => {
      const { service } = build(['id-1', 'id-2'], [], [{ caseId: 'c1', attachmentId: 'id-1' }])
      await service.upload(uploadOf(constancia), admin)
      await service.upload(uploadOf(constancia), admin)

      const list = await service.list('c1')

      expect(list.map((a) => [a.id, a.linkedToDelivery])).toEqual([
        ['id-1', true],
        ['id-2', false],
      ])
    })

    it('una recién subida no está ligada', async () => {
      const { service } = build()
      const row = await service.upload(uploadOf(constancia), admin)
      expect(row.linkedToDelivery).toBe(false)
    })

    it('borrar una constancia ligada lanza AttachmentInUseError y no borra nada', async () => {
      const { service, storage, eventLog } = build(
        ['id-1'],
        [],
        [{ caseId: 'c1', attachmentId: 'id-1' }],
      )
      await service.upload(uploadOf(constancia), admin)

      const err = await service.remove('id-1', admin).catch((e: unknown) => e)

      expect(err).toBeInstanceOf(AttachmentInUseError)
      expect((err as Error).message).toBe(DELIVERY_PROOF_LOCKED_MESSAGE)
      expect(await storage.exists('c1/id-1.jpg')).toBe(true)
      expect(await service.list('c1')).toHaveLength(1)
      expect(eventLog.some((e) => e.type === 'attachment_removed')).toBe(false)
    })

    it('una constancia sin usar se borra', async () => {
      const { service, storage } = build(['id-1'], [], [{ caseId: 'c1', attachmentId: 'otra' }])
      await service.upload(uploadOf(constancia), admin)

      await service.remove('id-1', admin)

      expect(await storage.exists('c1/id-1.jpg')).toBe(false)
    })
  })

  // Iteración 4, decisión 5 del plan: el mensajero solo sube la constancia de entrega.
  describe('subida por rol', () => {
    it.each([
      ['una foto', 'photo' as const],
      ['un adjunto sin tipo', null],
    ])('el mensajero no puede subir %s', async (_caso, kind) => {
      const { service, storage } = build()
      await expect(service.upload(uploadOf({ kind }), mensajero)).rejects.toBeInstanceOf(
        AttachmentForbiddenError,
      )
      expect(await storage.exists('c1/id-1.jpg')).toBe(false)
    })

    it('el mensajero sube la constancia de su entrega pendiente', async () => {
      const { service } = build(['id-1'], [{ caseId: 'c1', type: 'entrega', courierId: 'u3' }])
      const row = await service.upload(uploadOf({ kind: 'constancia' }), mensajero)
      expect(row).toMatchObject({ kind: 'constancia', mime: 'image/jpeg', uploadedBy: 'u3' })
    })

    // UX4-01: el mensajero solo actúa sobre sus entregas (`canActOnDelivery`), también al
    // subir la constancia; si no, 403 y nada guardado ni registrado.
    it.each([
      [
        'la entrega pendiente es de otro mensajero',
        [{ caseId: 'c1', type: 'entrega' as const, courierId: 'u5' }],
      ],
      ['el trabajo no tiene entrega pendiente', []],
      [
        'lo pendiente es una recogida suya, no una entrega',
        [{ caseId: 'c1', type: 'recogida' as const, courierId: 'u3' }],
      ],
      [
        'su entrega pendiente es de otro trabajo',
        [{ caseId: 'c2', type: 'entrega' as const, courierId: 'u3' }],
      ],
    ])('el mensajero no sube una constancia si %s', async (_caso, pending) => {
      const { service, storage, eventLog } = build(['id-1'], pending)
      await expect(
        service.upload(uploadOf({ kind: 'constancia' }), mensajero),
      ).rejects.toBeInstanceOf(AttachmentForbiddenError)
      expect(await storage.exists('c1/id-1.jpg')).toBe(false)
      expect(eventLog).toEqual([])
    })

    it('otro mensajero no sube la constancia de una entrega ajena', async () => {
      const { service } = build(['id-1'], [{ caseId: 'c1', type: 'entrega', courierId: 'u3' }])
      await expect(
        service.upload(uploadOf({ kind: 'constancia' }), otroMensajero),
      ).rejects.toBeInstanceOf(AttachmentForbiddenError)
    })

    it.each([
      ['admin', admin],
      ['recepción', recepcion],
    ])('%s sube la constancia de la entrega pendiente de cualquier mensajero', async (_q, ctx) => {
      const { service } = build(['id-1'], [{ caseId: 'c1', type: 'entrega', courierId: 'u3' }])
      const row = await service.upload(uploadOf({ kind: 'constancia' }), ctx)
      expect(row.kind).toBe('constancia')
    })

    // Misma tolerancia que `marcar_entregado` (`canActOnDelivery`): quien administra entregas
    // puede entregar un trabajo enviado sin entrega pendiente (datos anteriores a la It. 4).
    it('recepción sube una constancia aunque el trabajo no tenga entrega pendiente', async () => {
      const { service } = build()
      const row = await service.upload(uploadOf({ kind: 'constancia' }), recepcion)
      expect(row.kind).toBe('constancia')
    })

    it('el técnico sigue subiendo fotos', async () => {
      const { service } = build()
      const row = await service.upload(uploadOf({ kind: 'photo' }), tecnico)
      expect(row.kind).toBe('photo')
    })

    it('el técnico no sube constancias de entrega', async () => {
      const { service } = build()
      await expect(
        service.upload(uploadOf({ kind: 'constancia' }), tecnico),
      ).rejects.toBeInstanceOf(AttachmentForbiddenError)
    })

    it('una constancia que no es imagen se rechaza con UnsupportedFileError', async () => {
      const { service } = build()
      const pdf = new TextEncoder().encode('%PDF-1.4\ncontenido')
      await expect(
        service.upload(
          uploadOf({
            kind: 'constancia',
            filename: 'constancia.pdf',
            mime: 'application/pdf',
            size: pdf.byteLength,
            bytes: pdf,
          }),
          admin,
        ),
      ).rejects.toThrow(new UnsupportedFileError('La constancia debe ser una foto'))
    })
  })
})
