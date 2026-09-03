import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/configuracion')({
  component: () => <h1 className="text-2xl font-semibold">Configuración</h1>,
})
