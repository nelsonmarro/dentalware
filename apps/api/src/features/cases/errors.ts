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
