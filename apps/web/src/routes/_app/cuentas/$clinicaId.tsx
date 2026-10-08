import { createFileRoute } from '@tanstack/react-router'
import { ClinicAccountContent } from '@/features/accounts/clinic-account-content'

export const Route = createFileRoute('/_app/cuentas/$clinicaId')({
  component: ClinicAccountRoute,
})

function ClinicAccountRoute() {
  const { clinicaId } = Route.useParams()
  return <ClinicAccountContent clinicId={clinicaId} />
}
