import type { StageInput } from '@dentalware/shared'
import { asc, eq, inArray } from 'drizzle-orm'
import type { Db } from '../../db/index.ts'
import { stages } from './schema.ts'

export function listStages(db: Db, includeInactive: boolean) {
  return db
    .select()
    .from(stages)
    .where(includeInactive ? undefined : eq(stages.active, true))
    .orderBy(asc(stages.sort), asc(stages.name))
}
export async function createStage(db: Db, input: StageInput) {
  const [row] = await db.insert(stages).values(input).returning()
  return row!
}
export async function updateStage(db: Db, id: string, input: StageInput) {
  const [row] = await db
    .update(stages)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(stages.id, id))
    .returning()
  return row ?? null
}
export async function setStageActive(db: Db, id: string, active: boolean) {
  const [row] = await db
    .update(stages)
    .set({ active, updatedAt: new Date() })
    .where(eq(stages.id, id))
    .returning()
  return row ?? null
}
/** Reasigna sort = posición en `ids`; los ids desconocidos se ignoran. Devuelve la lista completa ordenada. */
export async function reorderStages(db: Db, ids: string[]) {
  const existing = await db.select({ id: stages.id }).from(stages).where(inArray(stages.id, ids))
  const known = new Set(existing.map((s) => s.id))
  await db.transaction(async (tx) => {
    let i = 0
    for (const id of ids) {
      if (!known.has(id)) continue
      await tx.update(stages).set({ sort: i, updatedAt: new Date() }).where(eq(stages.id, id))
      i++
    }
  })
  return listStages(db, true)
}
