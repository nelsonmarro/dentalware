import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { PhotoUploader } from './photo-uploader'

const { uploadAttachment } = vi.hoisted(() => ({ uploadAttachment: vi.fn() }))
vi.mock('./attachments-api', () => ({ uploadAttachment }))

describe('PhotoUploader', () => {
  it('sube el archivo elegido con la mutación y muestra el progreso mientras está pendiente', async () => {
    let resolveUpload!: (value: unknown) => void
    uploadAttachment.mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve
      }),
    )

    const { user } = renderWithProviders(<PhotoUploader caseId="caso-1" />)
    const file = new File(['contenido'], 'foto.png', { type: 'image/png' })
    const input = screen.getByLabelText('Subir archivo')

    await user.upload(input, file)

    await waitFor(() => expect(screen.getByText('1 de 1…')).toBeInTheDocument())
    expect(uploadAttachment).toHaveBeenCalledWith('caso-1', expect.any(FormData))

    resolveUpload({ id: 'a1' })
    await waitFor(() => expect(screen.queryByText('1 de 1…')).not.toBeInTheDocument())
  })
})
