import type { PricingUnit } from './schemas/config.ts'

export type ReadinessInput = {
  clinicId: string | null
  doctorId: string | null
  patientRef: string | null
  dueDate: string | null
  shade: string | null
  prescription: string | null
  hasPrescriptionDocument: boolean
  requiresShade?: boolean
  /** La lista de la orden en papel registra **lo recibido**, no obliga a tenerlo todo: un
   * trabajo puede legítimamente no necesitar antagonista. Por eso `missingForAccept` la
   * recibe (la ficha la muestra) pero no la exige. Decidido al planificar la Iteración 3. */
  checklist: { antagonista: boolean; mordida: boolean; color: boolean; fotos: boolean }
  items: { pricingUnit: PricingUnit; teeth: readonly number[] }[]
}

/** Datos obligatorios para Aceptar (spec §7). Devuelve etiquetas en español de lo que falta. */
export function missingForAccept(c: ReadinessInput): string[] {
  const missing: string[] = []
  if (!c.clinicId) missing.push('Clínica')
  if (!c.doctorId) missing.push('Doctor')
  if (!c.patientRef?.trim()) missing.push('Referencia del paciente')
  if (c.items.length === 0) missing.push('Al menos una línea de trabajo')
  c.items.forEach((it, i) => {
    if (it.pricingUnit === 'por_pieza' && it.teeth.length === 0)
      missing.push(`Piezas de la línea ${i + 1}`)
  })
  if (!c.dueDate) missing.push('Fecha deseada')
  if (c.requiresShade && !c.shade?.trim()) missing.push('Color')
  if (!c.prescription?.trim() && !c.hasPrescriptionDocument)
    missing.push('Prescripción (texto o documento)')
  return missing
}
