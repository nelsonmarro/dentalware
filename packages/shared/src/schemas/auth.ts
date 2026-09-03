import { z } from 'zod'
import { USER_ROLES } from '../roles.ts'

export const userRoleSchema = z.enum(USER_ROLES)

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Correo inválido' })),
  password: z.string().min(8, { error: 'La contraseña debe tener al menos 8 caracteres' }),
})
export type LoginInput = z.infer<typeof loginSchema>
