import type { CaseAction, CaseStatus, UserRole } from '@dentalware/shared'

/** La forma de `estados.json`, el contrato entre el guion que lo escribe
 * (`scripts/referencia-estados.ts`) y el sitio que lo lee (`<Estados />`). Vive junto al JSON para
 * que el sitio no dependa de un guion. Orden: `CASE_STATUSES` y `CASE_ACTIONS` de shared. */
export type Estados = {
  estados: { clave: CaseStatus; rotulo: string }[]
  transiciones: {
    accion: CaseAction
    rotulo: string
    desde: CaseStatus[]
    hasta: CaseStatus
    roles: UserRole[]
  }[]
}
