import { z } from 'zod'
import { USER_ROLES } from '../roles.ts'

export const PRICING_UNITS = ['por_pieza', 'por_arcada', 'por_trabajo'] as const
export type PricingUnit = (typeof PRICING_UNITS)[number]

const nombre = z
  .string()
  .trim()
  .min(1, { error: 'El nombre es obligatorio' })
  .max(120, { error: 'Máximo 120 caracteres' })
// Los campos de texto opcionales se guardan como NULL en la base, nunca como cadena
// vacía: '' y los espacios en blanco se normalizan a null (tanto al enviar el
// formulario como al re-validar en el servidor un valor ya limpiado, que llega como
// `null` explícito en el JSON).
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Máximo ${max} caracteres` })
    .nullish()
    .transform((v) => (v ? v : null))
const uuid = z.uuid({ error: 'Identificador inválido' })
export const priceString = z
  .string()
  .trim()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, { error: 'El precio debe ser un número con hasta 2 decimales' })
const whatsappE164 = z
  .string()
  .trim()
  .nullish()
  .refine((v) => !v || /^\+[1-9]\d{7,14}$/.test(v), {
    error: 'El WhatsApp debe ir en formato internacional, ej. +593991234567',
  })
  .transform((v) => (v ? v : null))
const correoOpcional = z
  .string()
  .trim()
  .toLowerCase()
  .nullish()
  .refine((v) => !v || z.email().safeParse(v).success, { error: 'Correo inválido' })
  .transform((v) => (v ? v : null))

export const labSettingsSchema = z.object({
  name: nombre,
  ruc: textoOpcional(13),
  address: textoOpcional(200),
  phone: textoOpcional(60),
  logoUrl: textoOpcional(500),
  codePrefix: textoOpcional(6),
  ivaPct: z.coerce.number().int().min(0).max(100).default(15),
})
export type LabSettingsInput = z.infer<typeof labSettingsSchema>

export const clinicSchema = z.object({
  name: nombre,
  ruc: textoOpcional(13),
  address: textoOpcional(200),
  city: textoOpcional(80),
  phone: textoOpcional(60),
  whatsapp: whatsappE164,
  email: correoOpcional,
  paymentTermsDays: z.coerce
    .number()
    .int({ error: 'Debe ser un número entero' })
    .min(0, { error: 'No puede ser negativo' })
    .max(365)
    .default(0),
  notes: textoOpcional(1000),
})
export type ClinicInput = z.infer<typeof clinicSchema>

export const doctorSchema = z.object({
  clinicId: uuid,
  name: nombre,
  phone: textoOpcional(60),
  email: correoOpcional,
  notes: textoOpcional(1000),
})
export type DoctorInput = z.infer<typeof doctorSchema>

export const productCategorySchema = z.object({
  name: nombre,
  sort: z.coerce.number().int().min(0).default(0),
})
export type ProductCategoryInput = z.infer<typeof productCategorySchema>

export const productSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, { error: 'El código es obligatorio' })
    .max(20, { error: 'Máximo 20 caracteres' }),
  name: nombre,
  categoryId: uuid,
  pricingUnit: z.enum(PRICING_UNITS, { error: 'Unidad de precio inválida' }),
  basePrice: priceString,
  turnaroundDays: z.coerce.number().int({ error: 'Debe ser un número entero' }).min(0).max(365),
  requiresTryIn: z.boolean().default(false),
})
export type ProductInput = z.infer<typeof productSchema>

export const clinicPriceSchema = z.object({ price: priceString })
export type ClinicPriceInput = z.infer<typeof clinicPriceSchema>

export const stageSchema = z.object({
  name: nombre,
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { error: 'El color debe ser hexadecimal, ej. #0F766E' }),
  sort: z.coerce.number().int().min(0).default(0),
})
export type StageInput = z.infer<typeof stageSchema>

export const createUserSchema = z.object({
  name: nombre,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Correo inválido' })),
  password: z.string().min(8, { error: 'La contraseña debe tener al menos 8 caracteres' }),
  role: z.enum(USER_ROLES, { error: 'Rol inválido' }),
})
export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  name: nombre.optional(),
  role: z.enum(USER_ROLES, { error: 'Rol inválido' }).optional(),
  password: z
    .string()
    .min(8, { error: 'La contraseña debe tener al menos 8 caracteres' })
    .optional(),
})
export type UpdateUserInput = z.infer<typeof updateUserSchema>

export const idParamSchema = z.object({ id: uuid })
export const activeQuerySchema = z.object({
  incluirInactivos: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})
export const activeBodySchema = z.object({
  active: z.boolean({ error: 'Debe indicar activo o inactivo' }),
})
