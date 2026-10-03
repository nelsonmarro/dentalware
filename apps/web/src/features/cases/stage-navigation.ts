import { isLastStage, nextStage, previousStage, type StageRef } from '@dentalware/shared'

/** Dónde está el trabajo en la secuencia de fases: una sola fuente para `StageControl` (qué
 * botones pinta) y `ProductionPanel` (si «Finalizar» cede el primario a «Avanzar fase»).
 * Antes cada uno lo calculaba por su lado y divergían con fases que fallaron al cargar o con
 * la fase actual desactivada (M-1/M-2 de la revisión de la Tarea 4).
 *
 * `next` solo existe si la siguiente fase se **conoce**: cargando, con error o con la fase
 * actual desactivada es `undefined`. `stages` incluye las inactivas (para resolver el nombre
 * de la actual); `nextStage`/`previousStage`/`isLastStage` de shared solo cuentan las activas. */
export function stageNavigation<S extends StageRef>(
  stages: readonly S[],
  currentStageId: string | null,
  stagesError = false,
) {
  const current = stages.find((s) => s.id === currentStageId)
  return {
    loading: stages.length === 0 && !stagesError,
    current,
    currentInactive: !!current && !current.active,
    next: nextStage(stages, currentStageId),
    previous: stages.find((s) => s.id === previousStage(stages, currentStageId)?.id),
    last: isLastStage(stages, currentStageId),
  }
}
