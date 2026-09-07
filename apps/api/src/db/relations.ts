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
  cases: {
    clinic: r.one.clinics({ from: r.cases.clinicId, to: r.clinics.id }),
    doctor: r.one.doctors({ from: r.cases.doctorId, to: r.doctors.id }),
    technician: r.one.users({ from: r.cases.assignedTechnicianId, to: r.users.id }),
    stage: r.one.stages({ from: r.cases.currentStageId, to: r.stages.id }),
    creator: r.one.users({ from: r.cases.createdBy, to: r.users.id }),
    items: r.many.caseItems(),
    events: r.many.caseEvents(),
    attachments: r.many.attachments(),
  },
  caseItems: {
    case: r.one.cases({ from: r.caseItems.caseId, to: r.cases.id }),
    product: r.one.products({ from: r.caseItems.productId, to: r.products.id }),
  },
  caseEvents: {
    case: r.one.cases({ from: r.caseEvents.caseId, to: r.cases.id }),
    actor: r.one.users({ from: r.caseEvents.actorId, to: r.users.id }),
  },
  attachments: {
    case: r.one.cases({ from: r.attachments.caseId, to: r.cases.id }),
    uploader: r.one.users({ from: r.attachments.uploadedBy, to: r.users.id }),
  },
}))
