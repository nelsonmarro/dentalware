import { DELIVERY_PROOF_LOCKED_MESSAGE } from '@dentalware/shared'

export class AttachmentNotFoundError extends Error {
  constructor(m = 'El adjunto no existe') {
    super(m)
  }
}
export class UnsupportedFileError extends Error {}
export class FileTooLargeError extends Error {}
/** La constancia cerró una entrega: borrarla la dejaría «Hecha» sin foto (UX4-06, 409). */
export class AttachmentInUseError extends Error {
  constructor() {
    super(DELIVERY_PROOF_LOCKED_MESSAGE)
  }
}
/** El rol no puede subir este tipo de adjunto (el mensajero solo sube constancias). */
export class AttachmentForbiddenError extends Error {}

// Errores de dominio, no adaptadores: la ruta de adjuntos también traduce a HTTP el caso
// en que el trabajo asociado no existe (comparte el error con `cases`).
export { CaseNotFoundError } from '../cases/errors.ts'
