import { describe, expect, it } from 'vitest'
import { attachmentsTabLabel, isPhoto } from './attachment-kind'

/** I-1 de la revisión de la Tarea 5: había tres reglas de «foto» (`kind === 'photo'` en la
 * ficha corta, todo en el rótulo de la pestaña, «no es PDF» en la grilla). Una sola regla, la
 * misma con la que la API deriva `kind` (`isImage`: el MIME real); `kind` no sirve porque el
 * cliente lo puede forzar al subir. */
describe('isPhoto', () => {
  it('una imagen es foto', () => {
    expect(isPhoto({ mime: 'image/jpeg' })).toBe(true)
    expect(isPhoto({ mime: 'image/webp' })).toBe(true)
  })

  it('un PDF no es foto', () => {
    expect(isPhoto({ mime: 'application/pdf' })).toBe(false)
  })
})

describe('attachmentsTabLabel', () => {
  it('cuenta todos los adjuntos, porque la pestaña lista fotos y documentos', () => {
    expect(attachmentsTabLabel(3)).toBe('Adjuntos (3)')
  })
})
