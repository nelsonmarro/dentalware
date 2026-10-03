import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { getSessionStatus, INVALID_ROLE_MESSAGE, signOut } from '@/features/auth/session'
import { LoginForm } from '@/features/auth/login-form'
import { redirectCaseCode } from '@/features/auth/redirect-case-code'
import { safeRedirect } from '@/features/auth/safe-redirect'

// Tolerante (`docs/conventions.md` §5): un `?redirect=` malformado cae a `{}` en vez de tumbar
// la ruta con el errorComponent del router.
const loginSearchSchema = z.object({ redirect: z.string().optional() }).partial().catch({})

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ search }) => {
    const result = await getSessionStatus()
    // Con sesión ya iniciada, al destino pedido (si es interno) en vez de siempre a Inicio: esta
    // tarea es la dueña de la redirección tras login (ruling C3, issue #20).
    if (result.status === 'ok') throw redirect({ to: safeRedirect(search.redirect) ?? '/' })
    // 'invalid-role' no redirige: `_app.tsx` ya trajo aquí a esa sesión (trata el rol
    // desconocido como sin sesión válida) y redirigir de vuelta crearía un ida y vuelta con
    // esa ruta. Se queda en el login mostrando el motivo (issue #21).
    return { invalidRole: result.status === 'invalid-role' }
  },
  component: LoginPage,
})

function LoginPage() {
  const { invalidRole } = Route.useRouteContext()
  const { redirect: redirectTo } = Route.useSearch()
  const navigate = useNavigate()
  const router = useRouter()
  const caseCode = redirectCaseCode(redirectTo)
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
          {/* UX3-19: desde el QR, el login dice qué trabajo se abrirá tras entrar. */}
          {caseCode && (
            <p className="text-sm">
              Inicia sesión para abrir el trabajo <span className="font-mono">{caseCode}</span>
            </p>
          )}
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
          <LoginForm onSuccess={() => navigate({ to: safeRedirect(redirectTo) ?? '/' })} />
        </CardContent>
      </Card>
    </div>
  )
}
