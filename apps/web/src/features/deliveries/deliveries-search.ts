import { deliveryListQuerySchema } from '@dentalware/shared'
import { z } from 'zod'

const { shape } = deliveryListQuerySchema

/** `search` de `/entregas`, tolerante campo a campo (`docs/conventions.md` §5): un día mal
 * escrito en la URL cae a «hoy» sin perder el mensajero elegido, y al revés. */
const deliveriesSearchSchema = z.object({
  dia: shape.dia.optional().catch(undefined),
  mensajeroId: shape.mensajeroId.catch(undefined),
})

export type DeliveriesSearch = { dia?: string; mensajeroId?: string }

export function parseDeliveriesSearch(input: unknown): DeliveriesSearch {
  const { dia, mensajeroId } = deliveriesSearchSchema.catch({}).parse(input)
  // Sin claves `undefined`: la URL queda limpia al navegar con `search: (prev) => …`.
  return { ...(dia && { dia }), ...(mensajeroId && { mensajeroId }) }
}
