export type CatalogClinic = { id: string; name: string; active: boolean }
export type CatalogDoctor = { id: string; name: string; clinicId: string; active: boolean }
export type CatalogProduct = { id: string; code: string; name: string; active: boolean }

/** Puerto de OTRAS features (clinics, doctors, products): se inyecta en la raíz de composición. */
export interface ImportCatalog {
  clinics(): Promise<CatalogClinic[]>
  doctors(): Promise<CatalogDoctor[]>
  products(): Promise<CatalogProduct[]>
}
