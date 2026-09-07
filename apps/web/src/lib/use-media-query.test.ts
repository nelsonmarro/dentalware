import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { useMediaQuery } from './use-media-query'

describe('useMediaQuery', () => {
  it('devuelve el valor actual y se actualiza cuando el media query cambia', () => {
    const { notify } = setMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'))
    expect(result.current).toBe(true)

    setMatchMedia(false)
    act(() => notify())

    expect(result.current).toBe(false)
  })
})
