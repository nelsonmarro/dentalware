import type { CaseStatus } from './case-status.ts'

/** Qué le pasa al trabajo, dicho a la clínica (AVI-4). Exhaustivo: un estado nuevo no compila
 * sin decidir cómo se le cuenta a la clínica. `cobrado` se cuenta como entregado: el cobro no
 * se anuncia por WhatsApp. */
export const CASE_WHATSAPP_STATUS_TEXT: Record<CaseStatus, string> = {
  por_recoger: 'está registrado y pasaremos a recogerlo',
  nuevo: 'ya llegó al laboratorio',
  en_proceso: 'está en producción',
  en_espera: 'está en espera: necesitamos hablar con ustedes para continuar',
  en_prueba: 'va a su clínica para la prueba',
  terminado: 'está terminado y listo para entregar',
  enviado: 'va en camino a su clínica',
  entregado: 'fue entregado',
  cobrado: 'fue entregado',
  cancelado: 'fue cancelado',
}

/** Texto del aviso por WhatsApp (AVI-4): código, paciente y estado. No recibe importes, así
 * que nunca puede llevar un precio. */
export function caseWhatsappText(input: {
  labName: string | null
  code: string
  patientRef: string
  status: CaseStatus
}): string {
  const lab = input.labName?.trim()
  const from = lab ? `de ${lab}` : 'del laboratorio'
  return `Hola, le escribimos ${from}. El trabajo ${input.code} (paciente ${input.patientRef}) ${CASE_WHATSAPP_STATUS_TEXT[input.status]}.`
}
