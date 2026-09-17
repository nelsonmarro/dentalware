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
// react-remove-scroll (usado por Dialog/Select de Radix) llama `window.scrollTo` al bloquear y
// restaurar el scroll del body; jsdom SÍ define `scrollTo` (a diferencia de `ResizeObserver` o
// `hasPointerCapture` arriba), pero como un stub que solo registra "not implemented" en cada
// llamada — por eso aquí hace falta una asignación directa, `??=` no lo reemplazaría.
window.scrollTo = () => {}
