import type { LabSettingsInput } from '@dentalware/shared'
import { eq } from 'drizzle-orm'
import type { Db } from '../../db/index.ts'
import { labSettings } from './schema.ts'

export async function getLabSettings(db: Db) {
  const rows = await db.select().from(labSettings).limit(1)
  return rows[0] ?? null
}

export async function upsertLabSettings(db: Db, input: LabSettingsInput) {
  const current = await getLabSettings(db)
  if (!current) {
    const [row] = await db.insert(labSettings).values(input).returning()
    return row!
  }
  const [row] = await db
    .update(labSettings)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(labSettings.id, current.id))
    .returning()
  return row!
}
