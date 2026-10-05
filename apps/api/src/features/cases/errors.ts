// Contrato del puerto `DeliveryLog.markDone` (ADR 26: un error es contrato, no adaptador).
export { DeliveryProofMissingError } from '../deliveries/errors.ts'

export class CaseInputError extends Error {
  path: string
  constructor(message: string, path = '') {
    super(message)
    this.path = path
  }
}
export class CaseStateError extends Error {}
export class CaseNotFoundError extends Error {
  constructor() {
    super('El trabajo no existe')
  }
}
export class CaseForbiddenError extends Error {
  constructor(message = 'No tiene permiso para realizar esta acción') {
    super(message)
  }
}
