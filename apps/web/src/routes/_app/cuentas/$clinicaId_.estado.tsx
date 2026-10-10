import { toIsoDate } from '@dentalware/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AccountStatementPage } from '@/features/accounts/account-statement-page'
import { parseStatementSearch, statementRange } from '@/features/accounts/statement-search'

// `_` tras `$clinicaId`, como `trabajos/$caseId_.imprimir.tsx`: sin él, TanStack Router anida
// esta ruta bajo la cuenta de la clínica (sin `<Outlet />`) y nunca se vería. El rol lo filtra
// `cuentas.tsx` (ACCOUNTS_ROLES).
export const Route = createFileRoute('/_app/cuentas/$clinicaId_/estado')({
  validateSearch: parseStatementSearch,
  component: StatementRoute,
})

/** Estado de cuenta imprimible (CTA-5): el periodo vive en la URL (`?desde&hasta`; por omisión,
 * el mes en curso); el resto, en `features/accounts`. */
function StatementRoute() {
  const { clinicaId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  return (
    <AccountStatementPage
      clinicId={clinicaId}
      range={statementRange(search, toIsoDate(new Date()))}
      onRangeChange={(range) => void navigate({ search: range })}
    />
  )
}
