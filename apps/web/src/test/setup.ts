import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { setMatchMedia } from './match-media'

setMatchMedia(true) // escritorio por defecto
afterEach(() => cleanup())

// jsdom no implementa ResizeObserver ni el registro de captura de puntero que usa
// Radix UI (Select, Popover…) para posicionarse; sin este polyfill mínimo el
// componente lanza y las pruebas que abren un `<Select>` fallan.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver ??= ResizeObserverStub
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}
