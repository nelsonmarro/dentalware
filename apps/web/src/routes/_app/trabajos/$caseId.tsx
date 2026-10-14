import { CASE_NOTIFY_ROLES, hasRole, hidesPrices } from '@dentalware/shared'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { LoadError } from '@/components/load-error'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { attachmentsTabLabel } from '@/features/cases/attachment-kind'
import { CaseDetailTab } from '@/features/cases/case-detail-tab'
import { CaseHeader } from '@/features/cases/case-header'
import { parseCaseSearch } from '@/features/cases/case-search'
import { CaseHistory, historyTabLabel } from '@/features/cases/case-history'
import { CommentForm } from '@/features/cases/comment-form'
import { PhotosTab } from '@/features/cases/photos-tab'
import { ProductionPanel } from '@/features/cases/production-panel'
import { RemakesList } from '@/features/cases/remakes-list'
import { useAttachments } from '@/features/cases/use-attachments'
import { useAddComment, useCase, useCaseRemakes, useEvents } from '@/features/cases/use-cases'
import { useLabSettings } from '@/features/config/use-lab-settings'
import { useStages } from '@/features/stages/use-stages'
import { isNotFoundError } from '@/lib/api-error'

export const Route = createFileRoute('/_app/trabajos/$caseId')({
  validateSearch: parseCaseSearch,
  component: CasePage,
})

function CasePage() {
  const { caseId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const { foco } = Route.useSearch()
  const navigate = useNavigate()
  const q = useCase(caseId)
  const events = useEvents(caseId)
  const remakes = useCaseRemakes(caseId)
  const lab = useLabSettings(hasRole(CASE_NOTIFY_ROLES, user.role))
  const attachments = useAttachments(caseId)
  const addComment = useAddComment(caseId)
  // `true` (incluir inactivos): `StageControl` (en `ProductionPanel`) necesita resolver el nombre de la fase
  // actual del trabajo aunque se haya desactivado después de asignarla.
  const stages = useStages(true)

  // `foco` se quita de la URL cuando ya hay datos: antes, el enlace aún no está montado y no
  // recibiría el foco (`autoFocus` actúa al montar, en el mismo commit en que llegan los datos).
  useEffect(() => {
    if (foco && q.data) {
      void navigate({ to: '/trabajos/$caseId', params: { caseId }, search: {}, replace: true })
    }
  }, [foco, q.data, caseId, navigate])

  if (q.isPending) return <p className="text-sm text-muted-foreground">Cargando…</p>
  if (q.isError) {
    // UX3-02: solo un 404 real es "el trabajo no existe"; un fallo de red o del servidor se
    // puede reintentar y no debe mandar a la lista como si el trabajo nunca hubiera existido.
    if (!isNotFoundError(q.error)) {
      return <LoadError onRetry={() => void q.refetch()} autoFocus />
    }
    return (
      <EmptyState
        title="El trabajo no existe"
        pageTitle
        action={
          <Button asChild>
            <Link to="/trabajos">Volver a trabajos</Link>
          </Button>
        }
      />
    )
  }
  if (!q.data) return null

  const hidePrices = hidesPrices(user.role)

  return (
    <div className="flex flex-col gap-6">
      <CaseHeader
        case={q.data.case}
        missing={q.data.missing}
        role={user.role}
        events={events.data ?? []}
        remakes={remakes.data ?? []}
        labName={lab.data?.name ?? null}
        focusWhatsapp={foco === 'whatsapp'}
      />
      <ProductionPanel
        case={q.data.case}
        missing={q.data.missing}
        role={user.role}
        self={{ id: user.id, name: user.name }}
        stages={stages.data ?? []}
        stagesError={stages.isError}
        onRemakeCreated={(created) =>
          void navigate({ to: '/trabajos/$caseId', params: { caseId: created.id } })
        }
      />
      <Tabs defaultValue="detalle">
        <TabsList>
          <TabsTrigger value="detalle">Detalle</TabsTrigger>
          <TabsTrigger value="fotos">
            {attachmentsTabLabel(attachments.data?.length ?? 0)}
          </TabsTrigger>
          <TabsTrigger value="historial">{historyTabLabel(events.data?.length ?? 0)}</TabsTrigger>
        </TabsList>
        <TabsContent value="detalle" className="flex flex-col gap-6 pt-4">
          <CaseDetailTab case={q.data.case} hidePrices={hidePrices} role={user.role} />
          <RemakesList caseId={caseId} />
        </TabsContent>
        <TabsContent value="fotos" className="pt-4">
          <PhotosTab caseId={caseId} role={user.role} />
        </TabsContent>
        <TabsContent value="historial" className="flex flex-col gap-4 pt-4">
          <CommentForm onSubmit={(v) => addComment.mutate(v.text)} pending={addComment.isPending} />
          <CaseHistory events={events.data ?? []} case={q.data.case} stages={stages.data ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
