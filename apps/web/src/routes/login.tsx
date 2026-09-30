import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { getSessionStatus, INVALID_ROLE_MESSAGE } from '@/features/auth/session'
import { LoginForm } from '@/features/auth/login-form'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const result = await getSessionStatus()
    if (result.status === 'ok') throw redirect({ to: '/' })
    // 'invalid-role' no redirige: `_app.tsx` ya trajo aquí a esa sesión (trata el rol
    // desconocido como sin sesión válida) y redirigir de vuelta crearía un ida y vuelta con
    // esa ruta. Se queda en el login mostrando el motivo (issue #21).
    return { invalidRole: result.status === 'invalid-role' }
  },
  component: LoginPage,
})

function LoginPage() {
  const { invalidRole } = Route.useRouteContext()
  const navigate = useNavigate()
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-[400px] border-l-4 border-l-primary">
        <CardHeader>
          <h1 className="text-2xl font-semibold">Dentalware</h1>
          <p className="text-muted-foreground">Laboratorio dental</p>
        </CardHeader>
        <CardContent>
          {invalidRole && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              {INVALID_ROLE_MESSAGE}
            </p>
          )}
          <LoginForm onSuccess={() => navigate({ to: '/' })} />
        </CardContent>
      </Card>
    </div>
  )
}
