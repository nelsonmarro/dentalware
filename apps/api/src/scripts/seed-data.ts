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
// Colores de fase: distintos entre sí y del teal primario #0F766E, reservado para la
// acción principal, enlaces activos y el anillo de foco (UX1-06). Cada uno cumple
// contraste AA (>= 4.5:1) como texto sobre --teal-lab-soft (#D9EFEC), el fondo del
// chip de fase, y sobre fondos claros en general.
export const STAGES = [
  ['Recepción', '#5B6A6E'],
  ['Modelo', '#59677A'],
  ['Diseño', '#7351BB'],
  ['Estructura', '#2C67A4'],
  ['Cerámica/Acrílico', '#9C4221'],
  ['Acabado', '#835D0D'],
  ['Control de calidad', '#267249'],
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
