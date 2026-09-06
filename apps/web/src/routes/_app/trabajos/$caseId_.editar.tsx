import type { CaseStatus } from '@dentalware/shared'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { CaseForm } from '@/features/cases/case-form'
import { useCase, useUpdateCase } from '@/features/cases/use-cases'

// Nombre de archivo con `_` antes de `.editar`: TanStack Router interpreta
// `$caseId.editar.tsx` (sin el `_`) como anidado bajo `$caseId.tsx` (que ya existe como
// cascarón de la ficha, sin `<Outlet />`), así que esa nota mostraría la ficha en vez del
// formulario. El `_` final del segmento "escapa" el anidamiento y deja esta ruta
// independiente en `/trabajos/$caseId/editar`.
export const Route = createFileRoute('/_app/trabajos/$caseId_/editar')({
  beforeLoad: ({ context, params }) => {
    if (context.user.role !== 'admin' && context.user.role !== 'recepcion') {
      throw redirect({ to: '/trabajos/$caseId', params: { caseId: params.caseId } })
    }
  },
  component: EditCasePage,
})

// Debe reflejar `EDITABLE` en `apps/api/src/features/cases/repo.ts`: solo se edita un
// trabajo en `nuevo` o `en_proceso`; el resto responde 409 si se intenta guardar.
const EDITABLE: readonly CaseStatus[] = ['nuevo', 'en_proceso']

function EditCasePage() {
  const { caseId } = Route.useParams()
  const navigate = useNavigate()
  const { user } = Route.useRouteContext()
  const detail = useCase(caseId)
  const update = useUpdateCase()
  const editable = detail.data ? EDITABLE.includes(detail.data.case.status) : true

  useEffect(() => {
    if (detail.data && !editable) {
      toast.error(`No se puede editar un trabajo en estado "${detail.data.case.status}"`)
      void navigate({ to: '/trabajos/$caseId', params: { caseId } })
    }
  }, [detail.data, editable, caseId, navigate])

  if (detail.isPending) return <p className="text-sm text-muted-foreground">Cargando…</p>
  if (!detail.data || !editable) return null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Editar trabajo" description={`Código ${detail.data.case.code}`} />
      <CaseForm
        initial={detail.data.case}
        role={user.role}
        pending={update.isPending}
        onSubmit={(input) =>
          update.mutate(
            { id: caseId, input },
            {
              onSuccess: () => void navigate({ to: '/trabajos/$caseId', params: { caseId } }),
            },
          )
        }
      />
    </div>
  )
}
