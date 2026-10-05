import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { usePhotoUpload } from './use-photo-upload'

const { uploadAttachment } = vi.hoisted(() => ({ uploadAttachment: vi.fn() }))
vi.mock('./attachments-api', () => ({ uploadAttachment }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

beforeEach(() => {
  uploadAttachment.mockReset()
  vi.mocked(toast.error).mockReset()
  vi.mocked(toast.success).mockReset()
})

function fileList(files: File[]): FileList {
  return {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: files[Symbol.iterator].bind(files),
  } as unknown as FileList
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

/**
 * Tarea 15 (FIC-3 #73): lógica de subida extraída de `PhotoUploader` para que `QuickCase`
 * (solo cámara) la reutilice sin duplicar el bucle de compresión + subida en serie.
 * Mismo comportamiento que ya probaba `photo-uploader.test.tsx`, ahora a nivel de hook.
 */
describe('usePhotoUpload', () => {
  it('sube el archivo con la mutación y marca el progreso mientras está pendiente', async () => {
    let resolveUpload!: (value: unknown) => void
    uploadAttachment.mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve
      }),
    )
    const { result } = renderHook(() => usePhotoUpload('caso-1'), { wrapper })
    const file = new File(['contenido'], 'foto.png', { type: 'image/png' })

    let done: Promise<unknown> | undefined
    act(() => {
      done = result.current.handleFiles(fileList([file]))
    })
    await waitFor(() => expect(result.current.progress).toEqual({ done: 0, total: 1 }))
    expect(uploadAttachment).toHaveBeenCalledWith('caso-1', expect.any(FormData))

    resolveUpload({ id: 'a1' })
    await act(async () => {
      await done
    })
    expect(result.current.progress).toBeNull()
  })

  it('si la subida falla muestra un único toast con el mensaje del servidor', async () => {
    uploadAttachment.mockRejectedValue(new ApiError('El archivo supera los 25 MB', 413))
    const { result } = renderHook(() => usePhotoUpload('caso-1'), { wrapper })
    const file = new File(['contenido'], 'foto.png', { type: 'image/png' })

    await act(async () => {
      await result.current.handleFiles(fileList([file]))
    })

    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith('foto.png: El archivo supera los 25 MB')
  })

  it('llama a onUploaded al terminar la subida', async () => {
    uploadAttachment.mockResolvedValue({ id: 'a1' })
    const onUploaded = vi.fn()
    const { result } = renderHook(() => usePhotoUpload('caso-1', { onUploaded }), { wrapper })
    const file = new File(['contenido'], 'foto.png', { type: 'image/png' })

    await act(async () => {
      await result.current.handleFiles(fileList([file]))
    })

    expect(onUploaded).toHaveBeenCalledTimes(1)
  })

  // UX3-08: con guantes, el técnico no sabía si la foto había entrado.
  it('al subir una foto avisa «Foto añadida»', async () => {
    uploadAttachment.mockResolvedValue({ id: 'a1' })
    const { result } = renderHook(() => usePhotoUpload('caso-1'), { wrapper })
    const file = new File(['contenido'], 'foto.png', { type: 'image/png' })

    await act(async () => {
      await result.current.handleFiles(fileList([file]))
    })

    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Foto añadida')
  })

  it('con varias fotos avisa una sola vez cuántas entraron', async () => {
    uploadAttachment
      .mockResolvedValueOnce({ id: 'a1' })
      .mockRejectedValueOnce(new ApiError('Formato no permitido', 415))
      .mockResolvedValueOnce({ id: 'a3' })
    const { result } = renderHook(() => usePhotoUpload('caso-1'), { wrapper })
    const files = ['a.png', 'b.png', 'c.png'].map(
      (n) => new File(['contenido'], n, { type: 'image/png' }),
    )

    await act(async () => {
      await result.current.handleFiles(fileList(files))
    })

    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('2 fotos añadidas')
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  // M-1 (revisión de la Tarea 5): desde la ficha completa también se sube la orden en PDF, y
  // avisar «Foto añadida» de un documento es falso.
  it('un PDF avisa «Documento añadido»', async () => {
    uploadAttachment.mockResolvedValue({ id: 'a1' })
    const { result } = renderHook(() => usePhotoUpload('caso-1'), { wrapper })
    const file = new File(['%PDF-'], 'orden.pdf', { type: 'application/pdf' })

    await act(async () => {
      await result.current.handleFiles(fileList([file]))
    })

    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Documento añadido')
  })

  it('varios PDF avisan cuántos documentos entraron', async () => {
    uploadAttachment.mockResolvedValue({ id: 'a1' })
    const { result } = renderHook(() => usePhotoUpload('caso-1'), { wrapper })
    const files = ['a.pdf', 'b.pdf'].map((n) => new File(['%PDF-'], n, { type: 'application/pdf' }))

    await act(async () => {
      await result.current.handleFiles(fileList(files))
    })

    expect(toast.success).toHaveBeenCalledWith('2 documentos añadidos')
  })

  it('una foto y un PDF juntos avisan «2 archivos añadidos»', async () => {
    uploadAttachment.mockResolvedValue({ id: 'a1' })
    const { result } = renderHook(() => usePhotoUpload('caso-1'), { wrapper })
    const files = [
      new File(['contenido'], 'foto.png', { type: 'image/png' }),
      new File(['%PDF-'], 'orden.pdf', { type: 'application/pdf' }),
    ]

    await act(async () => {
      await result.current.handleFiles(fileList(files))
    })

    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('2 archivos añadidos')
  })

  it('si ninguna foto entra no avisa éxito', async () => {
    uploadAttachment.mockRejectedValue(new ApiError('Formato no permitido', 415))
    const { result } = renderHook(() => usePhotoUpload('caso-1'), { wrapper })
    const file = new File(['contenido'], 'foto.png', { type: 'image/png' })

    await act(async () => {
      await result.current.handleFiles(fileList([file]))
    })

    expect(toast.success).not.toHaveBeenCalled()
  })

  it('sin archivos no llama a la mutación ni a onUploaded', async () => {
    const onUploaded = vi.fn()
    const { result } = renderHook(() => usePhotoUpload('caso-1', { onUploaded }), { wrapper })

    await act(async () => {
      await result.current.handleFiles(null)
    })

    expect(uploadAttachment).not.toHaveBeenCalled()
    expect(onUploaded).not.toHaveBeenCalled()
  })

  it('no fija el tipo del adjunto: la API lo decide por el archivo', async () => {
    uploadAttachment.mockResolvedValue({ id: 'a1' })
    const { result } = renderHook(() => usePhotoUpload('caso-1'), { wrapper })
    const file = new File(['contenido'], 'foto.png', { type: 'image/png' })

    await act(async () => {
      await result.current.handleFiles(fileList([file]))
    })

    const form = uploadAttachment.mock.calls[0]![1] as FormData
    expect(form.has('kind')).toBe(false)
  })

  it('devuelve los adjuntos que entraron, sin los que fallaron', async () => {
    uploadAttachment
      .mockResolvedValueOnce({ id: 'a1' })
      .mockRejectedValueOnce(new ApiError('Formato no permitido', 415))
    const { result } = renderHook(() => usePhotoUpload('caso-1'), { wrapper })
    const files = ['a.png', 'b.png'].map((n) => new File(['contenido'], n, { type: 'image/png' }))

    let uploaded: unknown
    await act(async () => {
      uploaded = await result.current.handleFiles(fileList(files))
    })

    expect(uploaded).toEqual([{ id: 'a1' }])
  })
})
