import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/page-header'

export const Route = createFileRoute('/_app/configuracion/productos')({
  component: () => <PageHeader title="Productos" />,
})
