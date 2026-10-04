import type { CaseAction } from '@dentalware/shared'

/** Peso visual de cada acción de estado (UX3-04): `primary` para el avance natural del trabajo,
 * `secondary` para los desvíos (pausar, enviar a prueba), `destructive` para cancelar y
 * `primary_last_stage` para «Finalizar», que solo es el avance natural en la última fase: antes
 * de ella el avance natural es «Avanzar fase» (UX3-05). */
export type ActionEmphasis = 'primary' | 'secondary' | 'destructive' | 'primary_last_stage'

/** `Record` exhaustivo: una acción nueva en `shared` no compila hasta decidir su peso. Lo usan
 * la barra de acciones y el botón que confirma el diálogo de motivo (M-5, revisión de la
 * Tarea 3), para que el que confirma nunca pese distinto del que abre. */
export const ACTION_EMPHASIS: Record<CaseAction, ActionEmphasis> = {
  recibir: 'primary',
  aceptar: 'primary',
  pausar: 'secondary',
  reanudar: 'primary',
  enviar_prueba: 'secondary',
  recibir_prueba: 'primary',
  finalizar: 'primary_last_stage',
  marcar_enviado: 'primary',
  marcar_entregado: 'primary',
  cancelar: 'destructive',
}

export type ActionButtonVariant = 'default' | 'outline' | 'destructive'

/** Variante de `Button` de una acción. `hasNextStage`: el trabajo tiene una fase siguiente (o
 * las fases todavía no cargaron), así que el primario del contexto es «Avanzar fase». */
export function actionVariant(action: CaseAction, hasNextStage = false): ActionButtonVariant {
  const emphasis = ACTION_EMPHASIS[action]
  switch (emphasis) {
    case 'primary':
      return 'default'
    case 'secondary':
      return 'outline'
    case 'destructive':
      return 'destructive'
    case 'primary_last_stage':
      return hasNextStage ? 'outline' : 'default'
  }
}
