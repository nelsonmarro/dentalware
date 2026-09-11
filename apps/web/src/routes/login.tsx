import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { getSession } from '@/features/auth/session'
import { LoginForm } from '@/features/auth/login-form'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const user = await getSession()
    if (user) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-[400px] border-l-4 border-l-primary">
        <CardHeader>
          <h1 className="text-2xl font-semibold">Dentalware</h1>
          <p className="text-muted-foreground">Laboratorio dental</p>
        </CardHeader>
        <CardContent>
          <LoginForm onSuccess={() => navigate({ to: '/' })} />
        </CardContent>
      </Card>
    </div>
  )
}
