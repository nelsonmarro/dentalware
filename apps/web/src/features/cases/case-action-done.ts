import type { CaseAction } from '@dentalware/shared'

/** Toast de éxito de cada acción de estado (UX3-11): dice qué pasó con el trabajo, no un
 * «Trabajo actualizado» genérico. `Record<CaseAction, …>` exhaustivo: una acción nueva en
 * `shared` no compila hasta que alguien escribe su confirmación. */
export const CASE_ACTION_DONE: Record<CaseAction, string> = {
  recibir: 'Trabajo recibido',
  aceptar: 'Trabajo aceptado',
  pausar: 'Trabajo en espera',
  reanudar: 'Trabajo reanudado',
  enviar_prueba: 'Enviado a prueba en boca',
  recibir_prueba: 'Prueba recibida: el trabajo vuelve a producción',
  finalizar: 'Trabajo finalizado',
  marcar_enviado: 'Marcado como enviado',
  marcar_entregado: 'Marcado como entregado',
  cancelar: 'Trabajo cancelado',
}
