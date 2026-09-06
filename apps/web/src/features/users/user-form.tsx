import {
  createUserSchema,
  updateUserSchema,
  USER_ROLES,
  type CreateUserInput,
  type UpdateUserInput,
  type UserRole,
} from '@dentalware/shared'
import {
  Controller,
  useForm,
  type FieldError as RhfFieldError,
  type Resolver,
} from 'react-hook-form'
import { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { User } from './api'
import { ROLE_LABEL } from './role-label'

type UserFormValues = {
  name: string
  email: string
  password: string
  role: UserRole
}

// El formulario deja "" en el campo de contraseña cuando no se quiere cambiar; en
// creación es obligatoria (createUserSchema), en edición debe aceptarse vacía sin
// disparar el mínimo de 8 caracteres de updateUserSchema.
const editUserFormSchema = updateUserSchema.extend({
  password: z
    .string()
    .min(8, { error: 'La contraseña debe tener al menos 8 caracteres' })
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export function UserForm({
  open,
  onOpenChange,
  user,
  currentUserId,
  onCreate,
  onUpdate,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  currentUserId: string
  onCreate: (input: CreateUserInput) => void
  onUpdate: (input: UpdateUserInput) => void
  pending: boolean
}) {
  const isEdit = user !== null
  // Resolver a mano: createUserSchema y updateUserSchema tienen formas distintas
  // (email obligatorio solo en creación), así que envolver ambos con zodResolver en un
  // único Resolver<UserFormValues> choca con la varianza de sus tipos de opciones/salida.
  // Validar directamente con safeParse evita ese conflicto sin perder las mismas reglas.
  const resolver: Resolver<UserFormValues> = async (values) => {
    const schema = isEdit ? editUserFormSchema : createUserSchema
    const result = await schema.safeParseAsync(values)
    // result.data viene recortado/normalizado por el esquema (trim, email en minúsculas);
    // en edición no incluye "email" (fuera de updateUserSchema), pero submit() no lo lee
    // en ese caso, así que el cast es seguro.
    if (result.success) return { values: result.data as UserFormValues, errors: {} }
    const errors: Partial<Record<keyof UserFormValues, RhfFieldError>> = {}
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof UserFormValues | undefined
      if (key && !errors[key]) errors[key] = { type: issue.code, message: issue.message }
    }
    return { values: {}, errors }
  }
  const form = useForm<UserFormValues>({
    resolver,
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      password: '',
      role: user?.role ?? 'tecnico',
    },
  })
  const roleDisabled = isEdit && user.id === currentUserId

  function submit(values: UserFormValues) {
    if (isEdit) {
      const input: UpdateUserInput = { name: values.name, role: values.role }
      if (values.password) input.password = values.password
      onUpdate(input)
      return
    }
    onCreate({
      name: values.name,
      email: values.email,
      password: values.password,
      role: values.role,
    })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Editar usuario' : 'Nuevo usuario'}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="user-form" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={form.handleSubmit(submit)} noValidate>
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="user-name">Nombre</FieldLabel>
                <Input
                  {...field}
                  id="user-name"
                  className="h-11"
                  autoComplete="name"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          {!isEdit && (
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="user-email">Correo</FieldLabel>
                  <Input
                    {...field}
                    id="user-email"
                    type="email"
                    className="h-11"
                    autoComplete="email"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          )}
          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="user-password">
                  {isEdit ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                </FieldLabel>
                <Input
                  {...field}
                  id="user-password"
                  type="password"
                  className="h-11"
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="role"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="user-role">Rol</FieldLabel>
                <Select
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={roleDisabled}
                >
                  <SelectTrigger id="user-role" className="h-11" aria-invalid={fieldState.invalid}>
                    <SelectValue placeholder="Elegir rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {roleDisabled && (
                  <FieldDescription>No puedes cambiar tu propio rol</FieldDescription>
                )}
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>
      </form>
    </FormDialog>
  )
}
