/** La clínica de una cuenta no existe: la ruta responde 404 «No encontrado». */
export class ClinicAccountNotFoundError extends Error {
  constructor() {
    super('No encontrado')
  }
}
