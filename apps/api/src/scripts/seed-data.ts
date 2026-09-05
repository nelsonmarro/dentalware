import { eq } from 'drizzle-orm'
import type { Db } from '../db/index.ts'
import { labSettings, productCategories, products, stages } from '../db/schema/index.ts'

const LAB = {
  name: 'Arte Dental',
  address: 'Puerto Rico N27-33 y La Isla',
  phone: '0961440991 / 0996081498',
  codePrefix: '',
  ivaPct: 15,
}
const CATEGORIES: {
  name: string
  sort: number
  products: {
    code: string
    name: string
    pricingUnit: 'por_pieza' | 'por_arcada' | 'por_trabajo'
    turnaroundDays: number
    requiresTryIn: boolean
  }[]
}[] = [
  {
    name: 'Prótesis fija',
    sort: 1,
    products: [
      {
        code: 'ZR',
        name: 'Zirconio',
        pricingUnit: 'por_pieza',
        turnaroundDays: 5,
        requiresTryIn: false,
      },
      {
        code: 'DL',
        name: 'Disilicato de litio',
        pricingUnit: 'por_pieza',
        turnaroundDays: 5,
        requiresTryIn: false,
      },
      {
        code: 'MP',
        name: 'Metal porcelana',
        pricingUnit: 'por_pieza',
        turnaroundDays: 6,
        requiresTryIn: true,
      },
    ],
  },
  {
    name: 'Prótesis removible',
    sort: 2,
    products: [
      {
        code: 'AC',
        name: 'Acrílico',
        pricingUnit: 'por_arcada',
        turnaroundDays: 7,
        requiresTryIn: true,
      },
      {
        code: 'CC',
        name: 'Cromo cobalto',
        pricingUnit: 'por_arcada',
        turnaroundDays: 10,
        requiresTryIn: true,
      },
      {
        code: 'PH',
        name: 'Prótesis híbrida',
        pricingUnit: 'por_arcada',
        turnaroundDays: 12,
        requiresTryIn: true,
      },
    ],
  },
]
const STAGES = [
  ['Recepción', '#5B6A6E'],
  ['Modelo', '#6B7C93'],
  ['Diseño', '#7C5CBF'],
  ['Estructura', '#2F6FB0'],
  ['Cerámica/Acrílico', '#0F766E'],
  ['Acabado', '#D99A16'],
  ['Control de calidad', '#2F8F5B'],
] as const

/** Idempotente: crea lo que falte (por nombre/código) y no toca lo existente. Precios base en 0.00 hasta que el admin los defina. */
export async function seedCatalogs(db: Db) {
  if ((await db.select({ id: labSettings.id }).from(labSettings).limit(1)).length === 0) {
    await db.insert(labSettings).values(LAB)
  }
  for (const cat of CATEGORIES) {
    let [row] = await db
      .select()
      .from(productCategories)
      .where(eq(productCategories.name, cat.name))
    if (!row)
      [row] = await db
        .insert(productCategories)
        .values({ name: cat.name, sort: cat.sort })
        .returning()
    for (const p of cat.products) {
      const exists = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.code, p.code))
      if (exists.length === 0)
        await db.insert(products).values({ ...p, categoryId: row!.id, basePrice: '0.00' })
    }
  }
  let i = 0
  for (const [name, color] of STAGES) {
    const exists = await db.select({ id: stages.id }).from(stages).where(eq(stages.name, name))
    if (exists.length === 0) await db.insert(stages).values({ name, color, sort: i })
    i++
  }
}
