import { createFileRoute } from '@tanstack/react-router'
import { PrintCasePage } from '@/features/cases/print-case-page'

// `_` antes de `.imprimir`, igual que `$caseId_.editar.tsx`: sin él, TanStack Router anida esta
// ruta bajo `$caseId.tsx` (la ficha, sin `<Outlet />`) y nunca se vería. El `_` la deja
// independiente en `/trabajos/$caseId/imprimir`.
export const Route = createFileRoute('/_app/trabajos/$caseId_/imprimir')({
  component: RouteComponent,
})

// La lógica (fetch, enmascarado por rol, layout de impresión) vive en `PrintCasePage`
// (`features/cases/`): este archivo solo lee la sesión y el parámetro de ruta y los reenvía,
// para que `docs/architecture.md` §3.3 ("routes/ solo importa de features/ y components/, sin
// lógica de negocio") se cumpla también aquí, y para que la pantalla sea testeable sin montar
// el árbol de rutas completo (I-3, ronda de fixes 1 de la Tarea 14, #71).
function RouteComponent() {
  const { caseId } = Route.useParams()
  const { user } = Route.useRouteContext()
  return <PrintCasePage caseId={caseId} role={user.role} />
}
