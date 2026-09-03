import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cuentas')({
  component: () => <h1 className="text-2xl font-semibold">Cuentas</h1>,
})
