import type { DoctorInput } from '@dentalware/shared'
import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../../db/index.ts'
import { clinics } from '../clinics/schema.ts'
import { doctors } from './schema.ts'

export async function clinicExists(db: Db, clinicId: string) {
  const rows = await db
    .select({ id: clinics.id })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1)
  return rows.length > 0
}

export function listDoctors(db: Db, opts: { clinicId?: string; includeInactive: boolean }) {
  const conds = []
  if (opts.clinicId) conds.push(eq(doctors.clinicId, opts.clinicId))
  if (!opts.includeInactive) conds.push(eq(doctors.active, true))
  return db
    .select()
    .from(doctors)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(doctors.name))
}

export async function createDoctor(db: Db, input: DoctorInput) {
  const [row] = await db.insert(doctors).values(input).returning()
  return row!
}

export async function updateDoctor(db: Db, id: string, input: DoctorInput) {
  const [row] = await db
    .update(doctors)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(doctors.id, id))
    .returning()
  return row ?? null
}

export async function setDoctorActive(db: Db, id: string, active: boolean) {
  const [row] = await db
    .update(doctors)
    .set({ active, updatedAt: new Date() })
    .where(eq(doctors.id, id))
    .returning()
  return row ?? null
}
