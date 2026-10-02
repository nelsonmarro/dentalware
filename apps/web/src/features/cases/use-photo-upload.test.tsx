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

    let done: Promise<void> | undefined
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
    const { result } = renderHook(() => usePhotoUpload('caso-1', onUploaded), { wrapper })
    const file = new File(['contenido'], 'foto.png', { type: 'image/png' })

    await act(async () => {
      await result.current.handleFiles(fileList([file]))
    })

    expect(onUploaded).toHaveBeenCalledTimes(1)
  })

  it('sin archivos no llama a la mutación ni a onUploaded', async () => {
    const onUploaded = vi.fn()
    const { result } = renderHook(() => usePhotoUpload('caso-1', onUploaded), { wrapper })

    await act(async () => {
      await result.current.handleFiles(null)
    })

    expect(uploadAttachment).not.toHaveBeenCalled()
    expect(onUploaded).not.toHaveBeenCalled()
  })
})
