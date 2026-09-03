import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/entregas')({
  component: () => <h1 className="text-2xl font-semibold">Entregas</h1>,
})
