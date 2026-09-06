import { createFileRoute } from '@tanstack/react-router'

// Cascarón: la ficha completa del trabajo se implementa en la Tarea 8.
export const Route = createFileRoute('/_app/trabajos/$caseId')({
  component: CaseDetailPlaceholder,
})

function CaseDetailPlaceholder() {
  const { caseId } = Route.useParams()
  return <h1 className="text-2xl font-semibold">Trabajo {caseId}</h1>
}
