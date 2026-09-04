import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { authClient } from '@/features/auth/auth-client'
import { LoginForm } from '@/features/auth/login-form'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const { data } = await authClient.getSession()
    if (data) throw redirect({ to: '/' })
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
