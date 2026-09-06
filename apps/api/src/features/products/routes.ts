import {
  activeQuerySchema,
  clinicPriceSchema,
  idParamSchema,
  productCategorySchema,
  productSchema,
} from '@dentalware/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import type { Db } from '../../db/index.ts'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireRole } from '../auth/session.ts'
import {
  categoryExists,
  codeExists,
  createCategory,
  createProduct,
  deleteClinicPrice,
  listCategories,
  listClinicPrices,
  listProducts,
  setCategoryActive,
  setProductActive,
  updateCategory,
  updateProduct,
  upsertClinicPrice,
} from './repo.ts'

const activeBody = z.object({ active: z.boolean({ error: 'Debe indicar activo o inactivo' }) })
const priceParams = z.object({
  clinicId: z.uuid({ error: 'Identificador inválido' }),
  productId: z.uuid({ error: 'Identificador inválido' }),
})
const clinicParam = z.object({ clinicId: z.uuid({ error: 'Identificador inválido' }) })
const canRead = requireRole('admin', 'recepcion') // los precios nunca llegan a técnico ni mensajero
const canWrite = requireRole('admin')

async function assertCategory(db: Db, id: string) {
  if (!(await categoryExists(db, id)))
    throw new HTTPException(422, { message: 'La categoría no existe' })
}
async function assertCodeFree(db: Db, code: string, exceptId?: string) {
  if (await codeExists(db, code, exceptId))
    throw new HTTPException(409, { message: 'Ya existe un producto con ese código' })
}

export const productsRoutes = (db: Db) =>
  new Hono<AppEnv>()
    // categorías
    .get('/categorias', canRead, validate('query', activeQuerySchema), async (c) =>
      c.json({ categories: await listCategories(db, c.req.valid('query').incluirInactivos) }, 200),
    )
    .post('/categorias', canWrite, validate('json', productCategorySchema), async (c) =>
      c.json({ category: await createCategory(db, c.req.valid('json')) }, 201),
    )
    .put(
      '/categorias/:id',
      canWrite,
      validate('param', idParamSchema),
      validate('json', productCategorySchema),
      async (c) => {
        const category = await updateCategory(db, c.req.valid('param').id, c.req.valid('json'))
        if (!category) throw new HTTPException(404, { message: 'La categoría no existe' })
        return c.json({ category }, 200)
      },
    )
    .patch(
      '/categorias/:id/activo',
      canWrite,
      validate('param', idParamSchema),
      validate('json', activeBody),
      async (c) => {
        const category = await setCategoryActive(
          db,
          c.req.valid('param').id,
          c.req.valid('json').active,
        )
        if (!category) throw new HTTPException(404, { message: 'La categoría no existe' })
        return c.json({ category }, 200)
      },
    )
    // precios por clínica
    .get('/precios/:clinicId', canRead, validate('param', clinicParam), async (c) =>
      c.json({ prices: await listClinicPrices(db, c.req.valid('param').clinicId) }, 200),
    )
    .put(
      '/precios/:clinicId/:productId',
      canWrite,
      validate('param', priceParams),
      validate('json', clinicPriceSchema),
      async (c) => {
        const { clinicId, productId } = c.req.valid('param')
        return c.json(
          {
            price: await upsertClinicPrice(db, clinicId, productId, c.req.valid('json').price),
          },
          200,
        )
      },
    )
    .delete(
      '/precios/:clinicId/:productId',
      canWrite,
      validate('param', priceParams),
      async (c) => {
        const { clinicId, productId } = c.req.valid('param')
        if (!(await deleteClinicPrice(db, clinicId, productId)))
          throw new HTTPException(404, { message: 'No hay precio especial' })
        return c.body(null, 204)
      },
    )
    // productos
    .get('/', canRead, validate('query', activeQuerySchema), async (c) =>
      c.json({ products: await listProducts(db, c.req.valid('query').incluirInactivos) }, 200),
    )
    .post('/', canWrite, validate('json', productSchema), async (c) => {
      const input = c.req.valid('json')
      await assertCategory(db, input.categoryId)
      await assertCodeFree(db, input.code)
      return c.json({ product: await createProduct(db, input) }, 201)
    })
    .put(
      '/:id',
      canWrite,
      validate('param', idParamSchema),
      validate('json', productSchema),
      async (c) => {
        const input = c.req.valid('json')
        const { id } = c.req.valid('param')
        await assertCategory(db, input.categoryId)
        await assertCodeFree(db, input.code, id)
        const product = await updateProduct(db, id, input)
        if (!product) throw new HTTPException(404, { message: 'El producto no existe' })
        return c.json({ product }, 200)
      },
    )
    .patch(
      '/:id/activo',
      canWrite,
      validate('param', idParamSchema),
      validate('json', activeBody),
      async (c) => {
        const product = await setProductActive(
          db,
          c.req.valid('param').id,
          c.req.valid('json').active,
        )
        if (!product) throw new HTTPException(404, { message: 'El producto no existe' })
        return c.json({ product }, 200)
      },
    )
