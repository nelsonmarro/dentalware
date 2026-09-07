import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CaseDetailTab } from '@/features/cases/case-detail-tab'
import { CaseHeader } from '@/features/cases/case-header'
import { CaseHistory, historyTabLabel } from '@/features/cases/case-history'
import { CommentForm } from '@/features/cases/comment-form'
import { PhotosTab } from '@/features/cases/photos-tab'
import { useAttachments } from '@/features/cases/use-attachments'
import { useAddComment, useCase, useEvents } from '@/features/cases/use-cases'

export const Route = createFileRoute('/_app/trabajos/$caseId')({
  component: CasePage,
})

function CasePage() {
  const { caseId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const q = useCase(caseId)
  const events = useEvents(caseId)
  const attachments = useAttachments(caseId)
  const addComment = useAddComment(caseId)

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
      <CaseHeader case={q.data.case} missing={q.data.missing} role={user.role} />
      <Tabs defaultValue="detalle">
        <TabsList>
          <TabsTrigger value="detalle">Detalle</TabsTrigger>
          <TabsTrigger value="fotos">Fotos ({attachments.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="historial">{historyTabLabel(events.data?.length ?? 0)}</TabsTrigger>
        </TabsList>
        <TabsContent value="detalle" className="pt-4">
          <CaseDetailTab case={q.data.case} hidePrices={hidePrices} role={user.role} />
        </TabsContent>
        <TabsContent value="fotos" className="pt-4">
          <PhotosTab caseId={caseId} role={user.role} />
        </TabsContent>
        <TabsContent value="historial" className="flex flex-col gap-4 pt-4">
          <CommentForm onSubmit={(v) => addComment.mutate(v.text)} pending={addComment.isPending} />
          <CaseHistory events={events.data ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
