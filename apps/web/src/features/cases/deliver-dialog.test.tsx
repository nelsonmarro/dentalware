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

beforeEach(() => {
  postCaseAction.mockReset()
  postCaseAction.mockResolvedValue({ id: 'c1', status: 'entregado' })
  uploadAttachment.mockReset()
  vi.mocked(toast.error).mockReset()
})

const enviado = { id: 'c1', status: 'enviado' } as unknown as CaseDetail
const foto = () => new File(['contenido'], 'foto.png', { type: 'image/png' })

async function abrir(onOpenChange: (open: boolean) => void = () => {}) {
  const r = renderWithProviders(<DeliverDialog case={enviado} open onOpenChange={onOpenChange} />)
  const dialog = await screen.findByRole('dialog', { name: 'Marcar entregado' })
  return { ...r, dialog }
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

  it('«Marcar entregado» está deshabilitado hasta que la foto termina de subir', async () => {
    let resolver!: (v: unknown) => void
    uploadAttachment.mockReturnValue(new Promise((r) => (resolver = r)))
    const { user, dialog } = await abrir()
    const marcar = within(dialog).getByRole('button', { name: 'Marcar entregado' })
    expect(marcar).toBeDisabled()

    await user.upload(within(dialog).getByLabelText('Foto de constancia'), foto())
    await waitFor(() => expect(uploadAttachment).toHaveBeenCalled())
    expect(marcar).toBeDisabled()

    resolver(constancia)
    await waitFor(() => expect(marcar).toBeEnabled())
    expect(within(dialog).getByRole('img', { name: 'Foto de constancia' })).toHaveAttribute(
      'src',
      '/api/adjuntos/a1/miniatura',
    )
    expect(within(dialog).getByRole('button', { name: 'Cambiar foto' })).toBeInTheDocument()
  })

  it('sube la foto como constancia del trabajo y envía su id', async () => {
    uploadAttachment.mockResolvedValue(constancia)
    const { user, dialog } = await abrir()
    await user.upload(within(dialog).getByLabelText('Foto de constancia'), foto())

    await waitFor(() => expect(uploadAttachment).toHaveBeenCalledWith('c1', expect.any(FormData)))
    const form = uploadAttachment.mock.calls[0]![1] as FormData
    expect(form.get('kind')).toBe('constancia')

    const marcar = within(dialog).getByRole('button', { name: 'Marcar entregado' })
    await waitFor(() => expect(marcar).toBeEnabled())
    await user.click(marcar)
    await waitFor(() =>
      expect(postCaseAction).toHaveBeenCalledWith('c1', {
        accion: 'marcar_entregado',
        motivo: null,
        constanciaId: 'a1',
      }),
    )
  })

  it('un fallo de subida muestra el aviso y no habilita el botón', async () => {
    uploadAttachment.mockRejectedValue(new ApiError('El archivo supera los 25 MB', 413))
    const { user, dialog } = await abrir()
    await user.upload(within(dialog).getByLabelText('Foto de constancia'), foto())

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('foto.png: El archivo supera los 25 MB'),
    )
    expect(within(dialog).getByRole('button', { name: 'Marcar entregado' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Tomar foto de constancia' })).toBeEnabled()
  })
  // UX4-05: otra persona canceló o cerró el trabajo mientras el diálogo seguía abierto. El 409
  // avisa una sola vez (lo hace `useCaseAction`) y el diálogo se cierra.
  it('un 409 al marcar entregado avisa una vez y cierra el diálogo', async () => {
    uploadAttachment.mockResolvedValue(constancia)
    postCaseAction.mockRejectedValue(
      new ApiError('No se puede "Marcar entregado": el trabajo está en estado "Cancelado".', 409),
    )
    const onOpenChange = vi.fn()
    const { user, dialog } = await abrir(onOpenChange)
    await user.upload(within(dialog).getByLabelText('Foto de constancia'), foto())
    const marcar = within(dialog).getByRole('button', { name: 'Marcar entregado' })
    await waitFor(() => expect(marcar).toBeEnabled())
    await user.click(marcar)

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(
      'No se puede "Marcar entregado": el trabajo está en estado "Cancelado".',
    )
  })

  it('otro fallo al marcar entregado avisa y deja el diálogo abierto para reintentar', async () => {
    uploadAttachment.mockResolvedValue(constancia)
    postCaseAction.mockRejectedValue(new TypeError('Failed to fetch'))
    const onOpenChange = vi.fn()
    const { user, dialog } = await abrir(onOpenChange)
    await user.upload(within(dialog).getByLabelText('Foto de constancia'), foto())
    const marcar = within(dialog).getByRole('button', { name: 'Marcar entregado' })
    await waitFor(() => expect(marcar).toBeEnabled())
    await user.click(marcar)

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    expect(onOpenChange).not.toHaveBeenCalled()
    await waitFor(() => expect(marcar).toBeEnabled())
  })
})
