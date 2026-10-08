/** La clínica de una cuenta no existe: la ruta responde 404 «No encontrado». */
export class ClinicAccountNotFoundError extends Error {
  constructor() {
    super('No encontrado')
  }
}

/** Dato inválido que depende de la BD (decisión 8 del plan): la ruta lo traduce a 422
 * `{ message: 'Datos inválidos', issues: [{ path, message }] }`, como `CaseInputError`. */
export class AccountInputError extends Error {
  path: string
  constructor(message: string, path: string) {
    super(message)
    this.path = path
  }
}

/** El pago no existe: 404 «No encontrado». */
export class PaymentNotFoundError extends Error {
  constructor() {
    super('No encontrado')
  }
}

/** El pago está anulado: no tiene saldo a favor ni se vuelve a anular (409). */
export class PaymentVoidedError extends Error {}

/** El rol no puede hacer esto con la cuenta (403 «Sin permiso»): la ruta ya lo filtra con su
 * constante de rol y el servicio lo vuelve a comprobar. */
export class AccountForbiddenError extends Error {
  constructor() {
    super('Sin permiso')
  }
}

/** La cuenta cambió varias veces mientras se registraba el ajuste (otros pagos al mismo
 * trabajo): 409, que se puede reintentar. */
export class AccountBusyError extends Error {
  constructor() {
    super('La cuenta cambió mientras se registraba el ajuste: vuelve a intentarlo')
  }
}
