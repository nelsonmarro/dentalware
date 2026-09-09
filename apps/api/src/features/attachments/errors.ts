export class AttachmentNotFoundError extends Error {
  constructor(m = 'El adjunto no existe') {
    super(m)
  }
}
export class UnsupportedFileError extends Error {}
export class FileTooLargeError extends Error {}

// Errores de dominio, no adaptadores: la ruta de adjuntos también traduce a HTTP el caso
// en que el trabajo asociado no existe (comparte el error con `cases`).
export { CaseNotFoundError } from '../cases/errors.ts'
