import { createFileRoute } from '@tanstack/react-router'
import { ClinicDetailContent } from '@/features/clinics/clinic-detail-content'

export const Route = createFileRoute('/_app/configuracion/clinicas/$clinicId')({
  component: ClinicDetailRoute,
})

function ClinicDetailRoute() {
  const { clinicId } = Route.useParams()
  return <ClinicDetailContent clinicId={clinicId} />
}
