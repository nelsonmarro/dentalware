import { screen, waitFor, within } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { renderWithProviders } from '@/test/render'
import type { CaseDetail } from './api'
import { DeliverDialog } from './deliver-dialog'

const { postCaseAction, uploadAttachment } = vi.hoisted(() => ({
  postCaseAction: vi.fn(),
  uploadAttachment: vi.fn(),
}))
vi.mock('./api', () => ({ postCaseAction }))
vi.mock('./attachments-api', () => ({ uploadAttachment }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const constancia = {
  id: 'a1',
  caseId: 'c1',
  kind: 'constancia',
  filename: 'foto.png',
  mime: 'image/png',
  url: '/api/adjuntos/a1',
  thumbUrl: '/api/adjuntos/a1/miniatura',
}

// jsdom no implementa las URL de objeto: cada foto elegida recibe la suya, para comprobar qué
// miniatura se pinta y cuál se revoca.
const createObjectURL = vi.fn()
const revokeObjectURL = vi.fn()

beforeEach(() => {
  postCaseAction.mockReset()
  postCaseAction.mockResolvedValue({ id: 'c1', status: 'entregado' })
  uploadAttachment.mockReset()
  uploadAttachment.mockResolvedValue(constancia)
  vi.mocked(toast.error).mockReset()
  vi.mocked(toast.success).mockReset()
  let n = 0
  createObjectURL.mockReset()
  createObjectURL.mockImplementation(() => `blob:foto-${++n}`)
  revokeObjectURL.mockReset()
  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = revokeObjectURL
})

const enviado = { id: 'c1', status: 'enviado' } as unknown as CaseDetail
const foto = (name = 'foto.png') => new File(['contenido'], name, { type: 'image/png' })

async function abrir(onOpenChange: (open: boolean) => void = () => {}) {
  const r = renderWithProviders(<DeliverDialog case={enviado} open onOpenChange={onOpenChange} />)
  const dialog = await screen.findByRole('dialog', { name: 'Marcar entregado' })
  const elegir = (file = foto()) =>
    r.user.upload(within(dialog).getByLabelText('Foto de constancia'), file)
  const marcar = () => within(dialog).getByRole('button', { name: /Marcar entregado|Guardando/ })
  return { ...r, dialog, elegir, marcar }
}

describe('DeliverDialog', () => {
  it('dice que fija la fecha de entrega y que pasa a la cuenta de la clínica', async () => {
    const { dialog } = await abrir()
    expect(
      within(dialog).getByText(
        'Se registrará la entrega con la fecha de hoy y el trabajo pasará a la cuenta de la clínica. No hay ninguna acción para deshacerlo.',
      ),
    ).toBeInTheDocument()
  })

  it('«Marcar entregado» está deshabilitado hasta que se elige la foto', async () => {
    const { elegir, marcar } = await abrir()
    expect(marcar()).toBeDisabled()
    await elegir()
    expect(marcar()).toBeEnabled()
  })

  // UX4-06: la foto se sube solo al confirmar. Elegirla muestra una miniatura local.
  it('elegir la foto muestra su miniatura local sin subir nada', async () => {
    const { dialog, elegir } = await abrir()
    await elegir()
    expect(within(dialog).getByRole('img', { name: 'Foto de constancia' })).toHaveAttribute(
      'src',
      'blob:foto-1',
    )
    expect(within(dialog).getByRole('button', { name: 'Cambiar foto' })).toBeInTheDocument()
    expect(uploadAttachment).not.toHaveBeenCalled()
  })

  it('al marcar entregado sube la foto como constancia y después envía su id', async () => {
    const { user, elegir, marcar } = await abrir()
    await elegir()
    await user.click(marcar())

    await waitFor(() =>
      expect(postCaseAction).toHaveBeenCalledWith('c1', {
        accion: 'marcar_entregado',
        motivo: null,
        constanciaId: 'a1',
      }),
    )
    expect(uploadAttachment).toHaveBeenCalledTimes(1)
    expect(uploadAttachment).toHaveBeenCalledWith('c1', expect.any(FormData))
    const form = uploadAttachment.mock.calls[0]![1] as FormData
    expect(form.get('kind')).toBe('constancia')
    expect((form.get('file') as File).name).toBe('foto.png')
    expect(uploadAttachment.mock.invocationCallOrder[0]!).toBeLessThan(
      postCaseAction.mock.invocationCallOrder[0]!,
    )
  })

  // I-1 (revisión de la Tarea 3): la constancia se comprime en el cliente antes de subir. En
  // jsdom no hay `createImageBitmap`; se sustituye como en `image-compress.test.ts`.
  it('comprime la foto a JPEG antes de subirla', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 3000, height: 2000, close: vi.fn() }),
    )
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((callback: BlobCallback) =>
        callback(new Blob(['comprimida'], { type: 'image/jpeg' })),
      )
    try {
      const { user, elegir, marcar } = await abrir()
      await elegir()
      await user.click(marcar())

      await waitFor(() => expect(uploadAttachment).toHaveBeenCalledTimes(1))
      const subida = (uploadAttachment.mock.calls[0]![1] as FormData).get('file') as File
      expect(subida.type).toBe('image/jpeg')
      expect(subida.name).toBe('foto.png')
    } finally {
      toBlob.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it('mientras sube y guarda, el botón dice «Guardando…» y no se puede repetir', async () => {
    let resolver!: (v: unknown) => void
    uploadAttachment.mockReturnValue(new Promise((r) => (resolver = r)))
    const { user, dialog, elegir, marcar } = await abrir()
    await elegir()
    await user.click(marcar())

    await waitFor(() => expect(marcar()).toHaveTextContent('Guardando…'))
    expect(marcar()).toBeDisabled()
    expect(within(dialog).getByRole('status')).toHaveTextContent('Subiendo foto…')
    await user.click(marcar())
    resolver(constancia)
    await waitFor(() => expect(postCaseAction).toHaveBeenCalledTimes(1))
    expect(uploadAttachment).toHaveBeenCalledTimes(1)
  })

  it('«Volver» después de elegir la foto no sube ninguna constancia', async () => {
    const onOpenChange = vi.fn()
    const { user, dialog, elegir } = await abrir(onOpenChange)
    await elegir()
    await user.click(within(dialog).getByRole('button', { name: 'Volver' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(uploadAttachment).not.toHaveBeenCalled()
  })

  it('«Cambiar foto» no sube la anterior: al confirmar sube solo la última', async () => {
    const { user, dialog, elegir, marcar } = await abrir()
    await elegir(foto('primera.png'))
    await elegir(foto('segunda.png'))
    expect(within(dialog).getByRole('img', { name: 'Foto de constancia' })).toHaveAttribute(
      'src',
      'blob:foto-2',
    )
    await user.click(marcar())

    await waitFor(() => expect(postCaseAction).toHaveBeenCalled())
    expect(uploadAttachment).toHaveBeenCalledTimes(1)
    const form = uploadAttachment.mock.calls[0]![1] as FormData
    expect((form.get('file') as File).name).toBe('segunda.png')
  })

  it('revoca la miniatura local al cambiar de foto y al cerrar', async () => {
    const { elegir, unmount } = await abrir()
    await elegir(foto('primera.png'))
    await elegir(foto('segunda.png'))
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:foto-1')
    expect(revokeObjectURL).not.toHaveBeenCalledWith('blob:foto-2')
    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:foto-2')
  })

  // UX4-15: entregar avisa una sola vez, con lo que le pasó al trabajo.
  it('al entregar avisa una sola vez', async () => {
    const { user, elegir, marcar } = await abrir()
    await elegir()
    await user.click(marcar())

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Marcado como entregado'))
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('si el envío falla después de subir, reintentar no vuelve a subir la foto', async () => {
    postCaseAction
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ id: 'c1', status: 'entregado' })
    const onOpenChange = vi.fn()
    const { user, elegir, marcar } = await abrir(onOpenChange)
    await elegir()
    await user.click(marcar())
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    expect(onOpenChange).not.toHaveBeenCalled()

    await waitFor(() => expect(marcar()).toBeEnabled())
    await user.click(marcar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(uploadAttachment).toHaveBeenCalledTimes(1)
    expect(postCaseAction).toHaveBeenLastCalledWith('c1', {
      accion: 'marcar_entregado',
      motivo: null,
      constanciaId: 'a1',
    })
  })

  it('un fallo de subida avisa una vez, no envía la acción y deja reintentar', async () => {
    uploadAttachment.mockRejectedValue(new ApiError('El archivo supera los 25 MB', 413))
    const onOpenChange = vi.fn()
    const { user, elegir, marcar } = await abrir(onOpenChange)
    await elegir()
    await user.click(marcar())

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('El archivo supera los 25 MB'))
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(postCaseAction).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
    await waitFor(() => expect(marcar()).toBeEnabled())
  })

  it('sin red al subir, avisa en español', async () => {
    uploadAttachment.mockRejectedValue(new TypeError('Failed to fetch'))
    const { user, elegir, marcar } = await abrir()
    await elegir()
    await user.click(marcar())
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('No se pudo subir la foto de constancia'),
    )
  })

  // Tarea 1 + UX4-05: si la entrega ya no es suya (403) o el trabajo cambió (409) cuando sube la
  // foto, se avisa una vez y el diálogo se cierra, igual que ante el 409 de la acción.
  it.each([
    [403, 'Sin permiso'],
    [409, 'El trabajo ya no tiene una entrega pendiente'],
  ])('un %i al subir la foto avisa una vez y cierra el diálogo', async (status, message) => {
    uploadAttachment.mockRejectedValue(new ApiError(message, status))
    const onOpenChange = vi.fn()
    const { user, elegir, marcar } = await abrir(onOpenChange)
    await elegir()
    await user.click(marcar())

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(message)
    expect(postCaseAction).not.toHaveBeenCalled()
  })

  // UX4-05: otra persona canceló o cerró el trabajo mientras el diálogo seguía abierto. El 409
  // avisa una sola vez (lo hace `useCaseAction`) y el diálogo se cierra.
  it('un 409 al marcar entregado avisa una vez y cierra el diálogo', async () => {
    postCaseAction.mockRejectedValue(
      new ApiError('No se puede "Marcar entregado": el trabajo está en estado "Cancelado".', 409),
    )
    const onOpenChange = vi.fn()
    const { user, elegir, marcar } = await abrir(onOpenChange)
    await elegir()
    await user.click(marcar())

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(
      'No se puede "Marcar entregado": el trabajo está en estado "Cancelado".',
    )
  })
})
