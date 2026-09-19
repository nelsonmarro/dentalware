export type StageRef = { id: string; sort: number; active: boolean }

/** Fases activas ordenadas por `sort`. Las inactivas no cuentan: una fase que el
 * laboratorio desactivó no debe aparecer al avanzar un trabajo que ya está en curso. */
const activos = (stages: readonly StageRef[]): StageRef[] =>
  stages.filter((s) => s.active).sort((a, b) => a.sort - b.sort)

export function firstStage(stages: readonly StageRef[]): StageRef | undefined {
  return activos(stages)[0]
}

export function nextStage(
  stages: readonly StageRef[],
  currentId: string | null,
): StageRef | undefined {
  if (!currentId) return undefined
  const lista = activos(stages)
  const i = lista.findIndex((s) => s.id === currentId)
  return i === -1 ? undefined : lista[i + 1]
}

export function previousStage(
  stages: readonly StageRef[],
  currentId: string | null,
): StageRef | undefined {
  if (!currentId) return undefined
  const lista = activos(stages)
  const i = lista.findIndex((s) => s.id === currentId)
  return i <= 0 ? undefined : lista[i - 1]
}

export function isLastStage(stages: readonly StageRef[], currentId: string | null): boolean {
  if (!currentId) return false
  const lista = activos(stages)
  const i = lista.findIndex((s) => s.id === currentId)
  return i !== -1 && i === lista.length - 1
}
