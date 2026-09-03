import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/trabajos')({
  component: () => <h1 className="text-2xl font-semibold">Trabajos</h1>,
})
