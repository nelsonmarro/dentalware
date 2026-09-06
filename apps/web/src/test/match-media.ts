import { vi } from 'vitest'

/** Simula window.matchMedia: `matches` indica si el media query de escritorio coincide. */
export function setMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>()
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  return { notify: () => listeners.forEach((cb) => cb()) }
}
