import { defineRelations } from 'drizzle-orm'
import * as schema from './schema/index.ts'

// Relaciones v2 de la app. `authRelations` (defineRelationsPart, generado por better-auth) se mezcla en createDb.
export const appRelations = defineRelations(schema, (r) => ({
  clinics: {
    doctors: r.many.doctors(),
    prices: r.many.clinicProductPrices(),
  },
  doctors: {
    clinic: r.one.clinics({ from: r.doctors.clinicId, to: r.clinics.id }),
  },
  productCategories: {
    products: r.many.products(),
  },
  products: {
    category: r.one.productCategories({ from: r.products.categoryId, to: r.productCategories.id }),
    clinicPrices: r.many.clinicProductPrices(),
  },
  clinicProductPrices: {
    clinic: r.one.clinics({ from: r.clinicProductPrices.clinicId, to: r.clinics.id }),
    product: r.one.products({ from: r.clinicProductPrices.productId, to: r.products.id }),
  },
}))
