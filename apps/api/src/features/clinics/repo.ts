import type { ClinicInput } from '@dentalware/shared'
import { eq } from 'drizzle-orm'
import type { Db } from '../../db/index.ts'
import { clinics } from './schema.ts'

export function listClinics(db: Db, includeInactive: boolean) {
  return db.query.clinics.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: { name: 'asc' },
  })
}

export function getClinicWithDoctors(db: Db, id: string) {
  return db.query.clinics.findFirst({
    where: { id },
    with: { doctors: { orderBy: { name: 'asc' } } },
  })
}

export async function createClinic(db: Db, input: ClinicInput) {
  const [row] = await db.insert(clinics).values(input).returning()
  return row!
}

export async function updateClinic(db: Db, id: string, input: ClinicInput) {
  const [row] = await db
    .update(clinics)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(clinics.id, id))
    .returning()
  return row ?? null
}

export async function setClinicActive(db: Db, id: string, active: boolean) {
  const [row] = await db
    .update(clinics)
    .set({ active, updatedAt: new Date() })
    .where(eq(clinics.id, id))
    .returning()
  return row ?? null
}
