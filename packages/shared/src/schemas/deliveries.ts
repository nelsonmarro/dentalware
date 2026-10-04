import { z } from 'zod'
import { CANCELLED_DELIVERY_REASON_PREFIX } from '../deliveries.ts'
import { isoDate } from './config.ts'

/** Id de usuario (mensajero): Better Auth no genera UUID (su id por omisión es una cadena
 * alfanumérica propia), así que no se valida con `uuid` — mismo criterio que `tecnicoId` en
 * `assignTechnicianSchema`, que ya usa `z.string().min(1)` por la misma razón. Desviación de
 * la Tarea 1 de la Iteración 4 respecto al literal del brief (`uuid`): documentada en el
 * reporte de la tarea, descubierta por el test de integración de `cases.test.ts` (un
 * `mensajeroId` real de Better Auth no pasaba `z.uuid()`). */
const userId = z.string().min(1, { error: 'Elige un mensajero' })

/** Datos de un envío: quién lo lleva y cuándo (ENT-2, marcar enviado). */
export const shipmentInputSchema = z.object({ mensajeroId: userId, fecha: isoDate })
export type ShipmentInput = z.infer<typeof shipmentInputSchema>

/** «Programar recogida» (ENT-1): misma forma que un envío, mensajero y fecha. */
export const pickupInputSchema = z.object({ mensajeroId: userId, fecha: isoDate })
export type PickupInput = z.infer<typeof pickupInputSchema>

/** `GET /api/entregas` (ENT-3, «mis entregas del día»): el mensajero ve solo las suyas (el
 * servicio fuerza su id, ver decisión 7 del plan); admin y recepción pueden filtrar por uno. */
export const deliveryListQuerySchema = z.object({
  dia: isoDate,
  mensajeroId: userId.optional(),
})
export type DeliveryListQuery = z.infer<typeof deliveryListQuerySchema>

/** `POST /api/entregas/:id/fallida` (ENT-5): cierra la entrega como fallida y reprograma una
 * nueva pendiente en una sola operación. El motivo no puede empezar con el prefijo de la
 * cancelación del trabajo (UX4-17): la web vería la entrega como anulada. */
export const deliveryFailSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(1, { error: 'Escribe el motivo' })
    .max(500, { error: 'Máximo 500 caracteres' })
    .refine((m) => !m.startsWith(CANCELLED_DELIVERY_REASON_PREFIX.trim()), {
      error: 'El motivo no puede empezar por «Trabajo cancelado:»',
    }),
  nuevaFecha: isoDate,
})
export type DeliveryFailInput = z.infer<typeof deliveryFailSchema>
