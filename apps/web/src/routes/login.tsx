import { loginSchema, type LoginInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const { data } = await authClient.getSession()
    if (data) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginInput) {
    setServerError(null)
    const { error } = await authClient.signIn.email(values)
    if (error) {
      setServerError('Correo o contraseña incorrectos')
      return
    }
    await navigate({ to: '/' })
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-[400px] border-l-4 border-l-primary">
        <CardHeader>
          <h1 className="text-2xl font-semibold">Dentalware</h1>
          <p className="text-muted-foreground">Laboratorio dental</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="h-11"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="h-11"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>
            {serverError && (
              <p className="text-sm text-destructive" role="alert">
                {serverError}
              </p>
            )}
            <Button type="submit" className="h-11 w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
