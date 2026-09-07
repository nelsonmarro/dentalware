import { sql } from 'drizzle-orm'
import type { Db } from './index.ts'

/**
 * Vacía todas las tablas de datos (cascade, conserva el esquema/migraciones). La usan
 * `test/setup.ts` (entre cada test) y `scripts/reset-test-db.ts` (antes de los E2E),
 * así que vive fuera de `src/test/` para poder importarse desde un script normal sin
 * salirse del `tsconfig.json` de build (que excluye `src/test/**`).
 */
export async function truncateAll(db: Db) {
  await db.execute(
    sql`truncate table "attachments", "case_events", "case_items", "cases", "case_sequences", "clinic_product_prices", "products", "product_categories", "doctors", "clinics", "stages", "lab_settings", "sessions", "accounts", "verifications", "users" cascade`,
  )
}
