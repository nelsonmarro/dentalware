import type { ProductCategoryInput, ProductInput } from '@dentalware/shared'
import { api } from '@/lib/api'
import { throwIfNotOk } from '@/lib/api-error'

const productos = api.api.config.productos
const q = (inactive: boolean): { query: { incluirInactivos: 'true' | 'false' } } => ({
  query: { incluirInactivos: inactive ? 'true' : 'false' },
})

export async function fetchCategories(inactive: boolean) {
  return (await (await throwIfNotOk(await productos.categorias.$get(q(inactive)))).json())
    .categories
}
export type Category = Awaited<ReturnType<typeof fetchCategories>>[number]

export async function saveCategory(id: string | undefined, input: ProductCategoryInput) {
  const res = id
    ? await productos.categorias[':id'].$put({ param: { id }, json: input })
    : await productos.categorias.$post({ json: input })
  return (await (await throwIfNotOk(res)).json()).category
}

export async function setCategoryActive(id: string, active: boolean) {
  return (
    await (
      await throwIfNotOk(
        await productos.categorias[':id'].activo.$patch({ param: { id }, json: { active } }),
      )
    ).json()
  ).category
}

export async function fetchProducts(inactive: boolean) {
  return (await (await throwIfNotOk(await productos.$get(q(inactive)))).json()).products
}
export type Product = Awaited<ReturnType<typeof fetchProducts>>[number]

export async function saveProduct(id: string | undefined, input: ProductInput) {
  const res = id
    ? await productos[':id'].$put({ param: { id }, json: input })
    : await productos.$post({ json: input })
  return (await (await throwIfNotOk(res)).json()).product
}

export async function setProductActive(id: string, active: boolean) {
  return (
    await (
      await throwIfNotOk(await productos[':id'].activo.$patch({ param: { id }, json: { active } }))
    ).json()
  ).product
}

export async function fetchClinicPrices(clinicId: string) {
  return (
    await (
      await throwIfNotOk(await productos.precios[':clinicId'].$get({ param: { clinicId } }))
    ).json()
  ).prices
}

export async function putClinicPrice(clinicId: string, productId: string, price: string) {
  return (
    await (
      await throwIfNotOk(
        await productos.precios[':clinicId'][':productId'].$put({
          param: { clinicId, productId },
          json: { price },
        }),
      )
    ).json()
  ).price
}

export async function deleteClinicPrice(clinicId: string, productId: string) {
  await throwIfNotOk(
    await productos.precios[':clinicId'][':productId'].$delete({ param: { clinicId, productId } }),
  )
}
