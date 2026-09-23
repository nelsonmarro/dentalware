import { z } from 'zod'
import { ACTIONS_REQUIRING_REASON, CASE_ACTIONS, CASE_STATUSES } from '../case-status.ts'
import { fdiTeethSchema } from '../fdi.ts'
import { priceString, textoOpcional, uuid } from './config.ts'

export const CASE_PRIORITIES = ['normal', 'urgente'] as const
export type CasePriority = (typeof CASE_PRIORITIES)[number]
export const PATIENT_SEXES = ['M', 'F'] as const
export type PatientSex = (typeof PATIENT_SEXES)[number]
export const SHADE_SYSTEMS = ['vita_classical', 'vita_3d_master', 'otro'] as const
export type ShadeSystem = (typeof SHADE_SYSTEMS)[number]
export const SHADE_SYSTEM_LABEL: Record<ShadeSystem, string> = {
  vita_classical: 'VITA Classical',
  vita_3d_master: 'VITA 3D-Master',
  otro: 'Otro',
}
export const ATTACHMENT_KINDS = ['photo', 'document', 'scan'] as const
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number]
export const CHECKLIST_KEYS = ['antagonista', 'mordida', 'color', 'fotos'] as const
export type ChecklistKey = (typeof CHECKLIST_KEYS)[number]
export const CHECKLIST_LABEL: Record<ChecklistKey, string> = {
  antagonista: 'Antagonista',
  mordida: 'Mordida',
  color: 'Color',
  fotos: 'Fotos',
}
export const CASE_VIEWS = [
  'nuevos',
  'en_curso',
  'vencen_hoy',
  'atrasados',
  'listos',
  'todos',
] as const
export type CaseView = (typeof CASE_VIEWS)[number]
export const CASE_PAGE_SIZE = 50

const ISO_DATE_FORMAT = 'Fecha inválida (AAAA-MM-DD)'
/** Descarta fechas con formato correcto pero de calendario inexistente (31/02, 13º mes…)
 * mediante ida y vuelta por `Date.UTC`: si el mes/día se desbordan, el resultado no
 * coincide con los componentes originales. */
function isRealCalendarDate(s: string): boolean {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d
}

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: ISO_DATE_FORMAT })
  .refine(isRealCalendarDate, { error: ISO_DATE_FORMAT })
const nullable = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null)
// Un campo numérico/de precio opcional llega del formulario como `''` cuando está
// vacío (un <input> controlado nunca pasa a `undefined`); sin este preprocesado,
// `z.coerce.number()` convertiría `''` en `0` y `priceString` rechazaría `''` por no
// cumplir su regex. Se normaliza `''`/espacios a `null` antes de validar, igual que ya
// se hace con `null`/`undefined`.
const emptyToNull = (v: string | number | null | undefined): string | number | null | undefined =>
  typeof v === 'string' && v.trim() === '' ? null : v
const emptyStringToNull = (v: string | null | undefined): string | null | undefined =>
  typeof v === 'string' && v.trim() === '' ? null : v
const nullableNumber = (min: number, max: number) =>
  z.preprocess(emptyToNull, nullable(z.coerce.number().int().min(min).max(max)))
const nullablePrice = z.preprocess(emptyStringToNull, nullable(priceString))

export const checklistSchema = z
  .object({
    antagonista: z.boolean(),
    mordida: z.boolean(),
    color: z.boolean(),
    fotos: z.boolean(),
  })
  .default({ antagonista: false, mordida: false, color: false, fotos: false })
export type Checklist = z.infer<typeof checklistSchema>

export const caseItemSchema = z.object({
  productId: uuid,
  description: textoOpcional(200),
  quantity: z.coerce
    .number({ error: 'Cantidad inválida' })
    .int({ error: 'Cantidad inválida' })
    .min(1, { error: 'La cantidad mínima es 1' })
    .max(99, { error: 'La cantidad máxima es 99' }),
  teeth: fdiTeethSchema.default([]),
  unitPrice: nullablePrice, // null → la API resuelve el precio de la clínica
  discountPct: z.coerce
    .number({ error: 'Descuento inválido' })
    .min(0, { error: 'El descuento no puede ser negativo' })
    .max(100, { error: 'El descuento máximo es 100 %' })
    .default(0),
  material: textoOpcional(120),
  notes: textoOpcional(500),
})
export type CaseItemInput = z.infer<typeof caseItemSchema>

export const caseInputSchema = z.object({
  clinicId: uuid,
  doctorId: uuid,
  patientRef: z
    .string()
    .trim()
    .min(1, { error: 'La referencia del paciente es obligatoria' })
    .max(120, { error: 'Máximo 120 caracteres' }),
  patientAge: nullableNumber(0, 120),
  patientSex: nullable(z.enum(PATIENT_SEXES)),
  boxNumber: textoOpcional(30),
  priority: z.enum(CASE_PRIORITIES).default('normal'),
  receivedAt: isoDate,
  dueDate: nullable(isoDate),
  shade: textoOpcional(30),
  shadeSystem: nullable(z.enum(SHADE_SYSTEMS)),
  reference: textoOpcional(120),
  checklist: checklistSchema,
  observations: textoOpcional(2000),
  prescription: textoOpcional(2000),
  internalNotes: textoOpcional(2000),
  assignedTechnicianId: nullable(z.string().min(1)),
  items: z.array(caseItemSchema).min(1, { error: 'Agrega al menos una línea de trabajo' }),
})
export type CaseInput = z.infer<typeof caseInputSchema>

/**
 * Bases de orden aceptadas por `GET /api/trabajos` (`orden`), cada una con su variante `-desc`.
 * En **todas** las ramas, la API antepone los trabajos urgentes antes de aplicar esta base
 * (`apps/api/src/features/cases/repo.ts:orderFor`): ordenar por «Código» ascendente no da una
 * lista estrictamente ascendente si hay urgentes mezclados con normales, porque la prioridad
 * manda primero. Es la regla del plan (recepción quiere ver los urgentes arriba siempre), no un
 * bug — pero quien toque el orden debe saberlo antes de asumir un orden puramente por columna.
 */
export const CASE_ORDERS = [
  'codigo',
  'codigo-desc',
  'entrega',
  'entrega-desc',
  'clinica',
  'clinica-desc',
  'estado',
  'estado-desc',
] as const
export type CaseOrder = (typeof CASE_ORDERS)[number]

export const caseListQuerySchema = z.object({
  vista: z.enum(CASE_VIEWS).default('todos'),
  estado: z.enum(CASE_STATUSES).optional(),
  clinicId: uuid.optional(),
  doctorId: uuid.optional(),
  tecnicoId: z.string().min(1).optional(),
  q: z.string().trim().max(60).optional(),
  desde: isoDate.optional(),
  hasta: isoDate.optional(),
  orden: z.enum(CASE_ORDERS, { error: 'Orden inválido' }).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
})
export type CaseListQuery = z.infer<typeof caseListQuerySchema>

export const commentSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, { error: 'Escribe un comentario' })
    .max(2000, { error: 'Máximo 2000 caracteres' }),
})
export type CommentInput = z.infer<typeof commentSchema>

export const REMAKE_RESPONSIBILITIES = ['laboratorio', 'clinica', 'compartida'] as const
export type RemakeResponsibility = (typeof REMAKE_RESPONSIBILITIES)[number]

const motivoObligatorio = z.string().trim().min(1, { error: 'Escribe el motivo' }).max(500)

export const caseActionSchema = z
  .object({
    accion: z.enum(CASE_ACTIONS, { error: 'Acción inválida' }),
    motivo: textoOpcional(500),
  })
  .superRefine((v, ctx) => {
    if (ACTIONS_REQUIRING_REASON.includes(v.accion) && !v.motivo)
      ctx.addIssue({ code: 'custom', path: ['motivo'], message: 'Escribe el motivo' })
  })
export type CaseActionInput = z.infer<typeof caseActionSchema>

export const stageChangeSchema = z
  .object({ direccion: z.enum(['avanzar', 'retroceder']), motivo: textoOpcional(500) })
  .superRefine((v, ctx) => {
    if (v.direccion === 'retroceder' && !v.motivo)
      ctx.addIssue({ code: 'custom', path: ['motivo'], message: 'Escribe el motivo' })
  })
export type StageChangeInput = z.infer<typeof stageChangeSchema>

export const assignTechnicianSchema = z.object({ tecnicoId: z.string().min(1).nullable() })
export type AssignTechnicianInput = z.infer<typeof assignTechnicianSchema>

/** Porcentaje del trabajo que se le cobra a la clínica al repetirlo (0–100).
 *
 * El campo llega como cadena desde el formulario, pero `z.coerce.number()` a secas convierte
 * `''` y `'   '` en **0** sin quejarse, y 0 significa "no se le cobra nada". Como no existe
 * ninguna pantalla donde `remakeChargePct` se pueda ver ni corregir después, un campo que se
 * quedó vacío por descuido solo se arreglaba tocando la BD, y la Iteración 5 lo leería como
 * una decisión deliberada del laboratorio. Por eso el vacío se rechaza **antes** de convertir,
 * con mensaje propio (I-4 de la revisión de la Tarea 9).
 *
 * La conversión es explícita (`Number`) en vez de `z.coerce`: la unión de entrada deja fuera
 * `null`, `[]` y `false`, que `Number` también convertiría en 0 en silencio. */
const porcentajeCobro = z
  .union([z.number(), z.string()], { error: 'Escribe el porcentaje a cobrar' })
  .refine((v) => typeof v === 'number' || v.trim() !== '', {
    error: 'Escribe el porcentaje a cobrar',
  })
  .transform((v) => (typeof v === 'number' ? v : Number(v)))
  .pipe(
    z
      .number({ error: 'El porcentaje debe ser un número' })
      .int({ error: 'El porcentaje debe ser un número entero' })
      .min(0, { error: 'El porcentaje no puede ser menor que 0' })
      .max(100, { error: 'El porcentaje no puede ser mayor que 100' }),
  )

export const remakeSchema = z.object({
  motivo: motivoObligatorio,
  responsabilidad: z.enum(REMAKE_RESPONSIBILITIES, { error: 'Responsabilidad inválida' }),
  cobroPct: porcentajeCobro,
})
export type RemakeInput = z.infer<typeof remakeSchema>
