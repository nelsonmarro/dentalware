import type { ProductCategoryInput, ProductInput } from '@dentalware/shared'
import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../../db/index.ts'
import { clinicProductPrices, productCategories, products } from './schema.ts'

// --- categorías ---
export function listCategories(db: Db, includeInactive: boolean) {
  return db
    .select()
    .from(productCategories)
    .where(includeInactive ? undefined : eq(productCategories.active, true))
    .orderBy(asc(productCategories.sort), asc(productCategories.name))
}
export async function categoryExists(db: Db, id: string) {
  return (
    (
      await db
        .select({ id: productCategories.id })
        .from(productCategories)
        .where(eq(productCategories.id, id))
        .limit(1)
    ).length > 0
  )
}
export async function createCategory(db: Db, input: ProductCategoryInput) {
  const [row] = await db.insert(productCategories).values(input).returning()
  return row!
}
export async function updateCategory(db: Db, id: string, input: ProductCategoryInput) {
  const [row] = await db
    .update(productCategories)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(productCategories.id, id))
    .returning()
  return row ?? null
}
export async function setCategoryActive(db: Db, id: string, active: boolean) {
  const [row] = await db
    .update(productCategories)
    .set({ active, updatedAt: new Date() })
    .where(eq(productCategories.id, id))
    .returning()
  return row ?? null
}

// --- productos ---
export function listProducts(db: Db, includeInactive: boolean) {
  return db.query.products.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: { name: 'asc' },
    with: { category: { columns: { id: true, name: true } } },
  })
}
export async function codeExists(db: Db, code: string, exceptId?: string) {
  const rows = await db.select({ id: products.id }).from(products).where(eq(products.code, code))
  return rows.some((r) => r.id !== exceptId)
}
export async function createProduct(db: Db, input: ProductInput) {
  const [row] = await db.insert(products).values(input).returning()
  return row!
}
export async function updateProduct(db: Db, id: string, input: ProductInput) {
  const [row] = await db
    .update(products)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning()
  return row ?? null
}
export async function setProductActive(db: Db, id: string, active: boolean) {
  const [row] = await db
    .update(products)
    .set({ active, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning()
  return row ?? null
}

// --- precios por clínica ---
export function listClinicPrices(db: Db, clinicId: string) {
  return db
    .select({ productId: clinicProductPrices.productId, price: clinicProductPrices.price })
    .from(clinicProductPrices)
    .where(eq(clinicProductPrices.clinicId, clinicId))
}
export async function upsertClinicPrice(
  db: Db,
  clinicId: string,
  productId: string,
  price: string,
) {
  const [row] = await db
    .insert(clinicProductPrices)
    .values({ clinicId, productId, price })
    .onConflictDoUpdate({
      target: [clinicProductPrices.clinicId, clinicProductPrices.productId],
      set: { price, updatedAt: new Date() },
    })
    .returning()
  return row!
}
export async function deleteClinicPrice(db: Db, clinicId: string, productId: string) {
  const rows = await db
    .delete(clinicProductPrices)
    .where(
      and(eq(clinicProductPrices.clinicId, clinicId), eq(clinicProductPrices.productId, productId)),
    )
    .returning()
  return rows.length > 0
}
/** Precio especial de la clínica o, si no existe, el precio base del producto. */
export async function resolvePrice(
  db: Db,
  clinicId: string,
  productId: string,
): Promise<string | null> {
  const special = await db
    .select({ price: clinicProductPrices.price })
    .from(clinicProductPrices)
    .where(
      and(eq(clinicProductPrices.clinicId, clinicId), eq(clinicProductPrices.productId, productId)),
    )
    .limit(1)
  if (special[0]) return special[0].price
  const base = await db
    .select({ price: products.basePrice })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)
  return base[0]?.price ?? null
}
