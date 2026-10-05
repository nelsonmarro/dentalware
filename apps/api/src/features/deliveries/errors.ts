import { DELIVERY_NOT_PENDING_MESSAGE } from '@dentalware/shared'

/** `fail` sobre una entrega que no existe o ya no está `pendiente` (hecha, fallida, o una
 * fallida de trabajo cancelado): un solo 409 uniforme, con el literal de `shared` (ruling de
 * la Tarea 6), que no distingue el motivo para no revelar si el id llegó a existir. */
export class DeliveryNotPendingError extends Error {
  constructor() {
    super(DELIVERY_NOT_PENDING_MESSAGE)
  }
}

/** El mensajero intenta actuar sobre una entrega que no es la suya (decisión 4 del plan). */
export class DeliveryForbiddenError extends Error {
  constructor(message = 'No tiene permiso para realizar esta acción') {
    super(message)
  }
}

/** Dato inválido que no puede expresarse en el schema de `shared` porque depende del reloj
 * (`nuevaFecha` no puede ser anterior a hoy): mismo contrato que `CaseInputError` de `cases`,
 * la ruta lo traduce a 422 `{ message: 'Datos inválidos', issues: [{ path, message }] }`. */
export class DeliveryInputError extends Error {
  path: string
  constructor(message: string, path = '') {
    super(message)
    this.path = path
  }
}

/** `markDone` liga una constancia que ya no existe: se borró entre la lectura del servicio y el
 * `UPDATE` (la FK `DELIVERY_PROOF_FK` lo impide y el repo traduce la violación). `cases` la
 * reexporta (ADR 26) y la responde como una constancia no válida (422). */
export class DeliveryProofMissingError extends Error {
  constructor() {
    super('La constancia de la entrega ya no existe.')
  }
}
