import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CaseActions } from '@/features/cases/case-actions'
import { CaseDetailTab } from '@/features/cases/case-detail-tab'
import { CaseHeader } from '@/features/cases/case-header'
import { CaseHistory, historyTabLabel } from '@/features/cases/case-history'
import { CommentForm } from '@/features/cases/comment-form'
import { PhotosTab } from '@/features/cases/photos-tab'
import { useAttachments } from '@/features/cases/use-attachments'
import { useAddComment, useCase, useEvents } from '@/features/cases/use-cases'
import { useStages } from '@/features/stages/use-stages'

export const Route = createFileRoute('/_app/trabajos/$caseId')({
  component: CasePage,
})

function CasePage() {
  const { caseId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()
  const q = useCase(caseId)
  const events = useEvents(caseId)
  const attachments = useAttachments(caseId)
  const addComment = useAddComment(caseId)
  // `true` (incluir inactivos): `StageControl` necesita resolver el nombre de la fase
  // actual del trabajo aunque se haya desactivado después de asignarla.
  const stages = useStages(true)

  if (q.isPending) return <p className="text-sm text-muted-foreground">Cargando…</p>
  if (q.isError || !q.data) {
    return (
      <EmptyState
        title="El trabajo no existe"
        action={
          <Button asChild>
            <Link to="/trabajos">Volver a trabajos</Link>
          </Button>
        }
      />
    )
  }

  const hidePrices = user.role === 'tecnico' || user.role === 'mensajero'

  return (
    <div className="flex flex-col gap-6">
      <CaseHeader
        case={q.data.case}
        missing={q.data.missing}
        role={user.role}
        events={events.data ?? []}
      />
      <CaseActions case={q.data.case} missing={q.data.missing} role={user.role} />
      <Tabs defaultValue="detalle">
        <TabsList>
          <TabsTrigger value="detalle">Detalle</TabsTrigger>
          <TabsTrigger value="fotos">Fotos ({attachments.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="historial">{historyTabLabel(events.data?.length ?? 0)}</TabsTrigger>
        </TabsList>
        <TabsContent value="detalle" className="pt-4">
          <CaseDetailTab
            case={q.data.case}
            hidePrices={hidePrices}
            role={user.role}
            stages={stages.data ?? []}
            stagesError={stages.isError}
            onRemakeCreated={(created) =>
              void navigate({ to: '/trabajos/$caseId', params: { caseId: created.id } })
            }
          />
        </TabsContent>
        <TabsContent value="fotos" className="pt-4">
          <PhotosTab caseId={caseId} role={user.role} />
        </TabsContent>
        <TabsContent value="historial" className="flex flex-col gap-4 pt-4">
          <CommentForm onSubmit={(v) => addComment.mutate(v.text)} pending={addComment.isPending} />
          <CaseHistory
            events={events.data ?? []}
            case={q.data.case}
            stages={stages.data ?? []}
            role={user.role}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
