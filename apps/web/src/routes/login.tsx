import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { getSessionStatus, INVALID_ROLE_MESSAGE, signOut } from '@/features/auth/session'
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
  const router = useRouter()
  // Con un rol no válido la sesión sigue abierta: sin cerrarla, nadie podría entrar con otro
  // usuario desde este navegador. Tras cerrar, `invalidate` repite el `beforeLoad` y el aviso
  // desaparece (issue #21, M-4).
  const handleSignOut = async () => {
    await signOut()
    await router.invalidate()
  }
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-[400px] border-l-4 border-l-primary">
        <CardHeader>
          <h1 className="text-2xl font-semibold">Dentalware</h1>
          <p className="text-muted-foreground">Laboratorio dental</p>
        </CardHeader>
        <CardContent>
          {invalidRole && (
            <div className="mb-4 flex flex-col gap-3">
              <p role="alert" className="text-sm text-destructive">
                {INVALID_ROLE_MESSAGE}
              </p>
              <Button type="button" variant="outline" className="w-full" onClick={handleSignOut}>
                Cerrar sesión
              </Button>
            </div>
          )}
          <LoginForm onSuccess={() => navigate({ to: '/' })} />
        </CardContent>
      </Card>
    </div>
  )
}
