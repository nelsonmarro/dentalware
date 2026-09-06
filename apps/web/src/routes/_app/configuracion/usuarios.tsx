import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/page-header'

export const Route = createFileRoute('/_app/configuracion/usuarios')({
  component: () => <PageHeader title="Usuarios" />,
})
