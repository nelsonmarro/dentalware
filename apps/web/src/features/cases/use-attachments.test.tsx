import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { useDeleteAttachment } from './use-attachments'

const { deleteAttachment } = vi.hoisted(() => ({ deleteAttachment: vi.fn() }))
vi.mock('./attachments-api', () => ({ deleteAttachment }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

beforeEach(() => {
  deleteAttachment.mockReset()
  vi.mocked(toast.error).mockReset()
})

describe('useDeleteAttachment', () => {
  // Convención §5: ante un 409 (la constancia quedó ligada a una entrega hecha mientras se
  // miraba) se espera el refresco de los adjuntos y después se avisa, para que la lista ya no
  // ofrezca borrar lo que no se puede.
  it('ante un 409 espera el refresco de los adjuntos antes de avisar', async () => {
    deleteAttachment.mockRejectedValue(
      new ApiError('Es la constancia de la entrega: no se puede borrar.', 409),
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    let finishRefresh!: () => void
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve
        }),
    )
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useDeleteAttachment('c1'), { wrapper })

    act(() => result.current.mutate('a1'))
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.attachments('c1') }),
    )
    expect(toast.error).not.toHaveBeenCalled()

    await act(async () => finishRefresh())
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Es la constancia de la entrega: no se puede borrar.',
      ),
    )
  })

  it('otro error avisa sin refrescar', async () => {
    deleteAttachment.mockRejectedValue(new TypeError('Failed to fetch'))
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useDeleteAttachment('c1'), { wrapper })
    act(() => result.current.mutate('a1'))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('No se pudo completar la operación'),
    )
    expect(invalidate).not.toHaveBeenCalled()
  })
})
