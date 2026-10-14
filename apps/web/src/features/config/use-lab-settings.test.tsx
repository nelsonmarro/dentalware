import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchLabSettings } from './api'
import { useLabSettings } from './use-lab-settings'

vi.mock('./api', () => ({
  fetchLabSettings: vi.fn(async () => ({ name: 'Arte Dental' })),
  saveLabSettings: vi.fn(),
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useLabSettings', () => {
  beforeEach(() => vi.mocked(fetchLabSettings).mockClear())

  it('con false no consulta la API', () => {
    const { result } = renderHook(() => useLabSettings(false), { wrapper })
    expect(fetchLabSettings).not.toHaveBeenCalled()
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('por omisión sí consulta', async () => {
    const { result } = renderHook(() => useLabSettings(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchLabSettings).toHaveBeenCalledTimes(1)
  })
})
