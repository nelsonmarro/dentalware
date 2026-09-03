import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '@/lib/api'

export const Route = createFileRoute('/_app/')({
  component: HomePage,
})

function HomePage() {
  const { user } = Route.useRouteContext()
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await api.api.health.$get()
      return res.json()
    },
  })
  const status = health.isPending ? 'comprobando…' : health.data?.ok ? 'conectada' : 'sin conexión'
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Inicio</h1>
      <p className="text-muted-foreground">Bienvenido, {user.name}</p>
      <p className="text-sm">
        <span className="text-muted-foreground">Estado del servidor: </span>
        <span className="font-mono" data-testid="api-status">
          API: {status}
        </span>
      </p>
    </div>
  )
}
