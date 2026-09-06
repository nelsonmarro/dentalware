import { z } from 'zod'
import { CASE_STATUSES } from '../case-status.ts'
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

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Fecha inválida (AAAA-MM-DD)' })
const nullable = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null)

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
  unitPrice: nullable(priceString), // null → la API resuelve el precio de la clínica
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
  patientAge: nullable(z.coerce.number().int().min(0).max(120)),
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

export const caseListQuerySchema = z.object({
  vista: z.enum(CASE_VIEWS).default('todos'),
  estado: z.enum(CASE_STATUSES).optional(),
  clinicId: uuid.optional(),
  doctorId: uuid.optional(),
  tecnicoId: z.string().min(1).optional(),
  q: z.string().trim().max(60).optional(),
  desde: isoDate.optional(),
  hasta: isoDate.optional(),
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
