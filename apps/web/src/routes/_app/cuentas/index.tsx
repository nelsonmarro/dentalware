import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PageHeader } from '@/components/page-header'
import { AccountsList } from '@/features/accounts/accounts-list'
import { parseAccountsSearch } from '@/features/accounts/accounts-search'

export const Route = createFileRoute('/_app/cuentas/')({
  validateSearch: parseAccountsSearch,
  component: CuentasPage,
})

/** «Cuentas» (CTA-1): cuánto debe cada clínica y desde cuándo. «Ver todas las clínicas» vive en
 * la URL (`?todas=1`); el resto, en `features/accounts`. */
function CuentasPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title="Cuentas" description="Cuánto debe cada clínica y desde cuándo." />
      <AccountsList
        todas={search.todas === 1}
        onTodasChange={(todas) =>
          void navigate({ search: (prev) => ({ ...prev, todas: todas ? 1 : undefined }) })
        }
      />
    </div>
  )
}
