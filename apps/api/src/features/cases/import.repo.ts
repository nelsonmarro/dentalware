import type { Db } from '../../db/index.ts'
import { clinics } from '../clinics/schema.ts'
import { doctors } from '../doctors/schema.ts'
import { products } from '../products/schema.ts'
import type { ImportCatalog } from './import.ports.ts'

/**
 * Adaptador driven del catálogo de importación: lee clínicas, doctores y productos de
 * otras features (ruling en `docs/architecture.md` §3.6: joins y lecturas de tablas
 * ajenas se permiten en el `repo.ts`, nunca en el servicio ni en la ruta).
 */
export const createImportCatalog = (db: Db): ImportCatalog => ({
  clinics: () =>
    db.select({ id: clinics.id, name: clinics.name, active: clinics.active }).from(clinics),
  doctors: () =>
    db
      .select({
        id: doctors.id,
        name: doctors.name,
        clinicId: doctors.clinicId,
        active: doctors.active,
      })
      .from(doctors),
  products: () =>
    db
      .select({
        id: products.id,
        code: products.code,
        name: products.name,
        active: products.active,
      })
      .from(products),
})
