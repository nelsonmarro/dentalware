import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { CaseForm } from '@/features/cases/case-form'
import { useCreateCase } from '@/features/cases/use-cases'

export const Route = createFileRoute('/_app/trabajos/nuevo')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'admin' && context.user.role !== 'recepcion') {
      throw redirect({ to: '/trabajos' })
    }
  },
  component: NewCasePage,
})

function NewCasePage() {
  const navigate = useNavigate()
  const create = useCreateCase()
  const { user } = Route.useRouteContext()
  // "Guardar y nuevo" reinicia el formulario con un `key` incremental: React lo
  // desmonta y monta de cero, así vuelve a sus valores por defecto sin arrastrar
  // estado (líneas, precios editados a mano) del trabajo recién creado.
  const [formKey, setFormKey] = useState(0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuevo trabajo"
        description="Registra la orden tal como llega de la clínica."
      />
      <CaseForm
        key={formKey}
        role={user.role}
        pending={create.isPending}
        onSubmit={(input, andNew) =>
          create.mutate(input, {
            onSuccess: (c) => {
              if (andNew) {
                setFormKey((k) => k + 1)
                window.scrollTo(0, 0)
              } else {
                void navigate({ to: '/trabajos/$caseId', params: { caseId: c.id } })
              }
            },
          })
        }
      />
    </div>
  )
}
