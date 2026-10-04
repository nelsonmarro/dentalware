import { createFileRoute } from '@tanstack/react-router'
import { QuickCase } from '@/features/cases/quick-case'

/**
 * Ficha corta del QR (`/t/:code`, Tarea 15, FIC-2 #72): dentro de `_app` para heredar el
 * `beforeLoad` de sesión de `_app.tsx` (que ya escribe `?redirect=<location.href>`) y volver
 * aquí tras el login (T17, `login.tsx`, sin tocar). Sin lógica propia: solo lee el código de
 * la URL y el rol de la sesión y los pasa a `QuickCase` (features/).
 * Ojo: el QR de la orden impresa (`features/cases/print-order.tsx`) codifica esta URL; si se
 * renombra la ruta, cambia también allí (órdenes ya impresas dejarían de abrir).
 */
export const Route = createFileRoute('/_app/t/$code')({
  component: QuickCasePage,
})

function QuickCasePage() {
  const { code } = Route.useParams()
  const { user } = Route.useRouteContext()
  return <QuickCase code={code} role={user.role} self={{ id: user.id, name: user.name }} />
}
