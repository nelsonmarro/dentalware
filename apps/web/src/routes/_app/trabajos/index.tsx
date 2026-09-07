import type { CaseView } from '@dentalware/shared'
import { CASE_VIEWS } from '@dentalware/shared'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CaseListQueryInput } from '@/features/cases/api'
import { CASE_VIEW_LABEL, parseCasesSearch } from '@/features/cases/case-views'
import { CasesFilters } from '@/features/cases/cases-filters'
import { CasesTable } from '@/features/cases/cases-table'
import { ImportDialog } from '@/features/cases/import-dialog'
import { useCases } from '@/features/cases/use-cases'
import { useClinics } from '@/features/clinics/use-clinics'
import { useDoctors } from '@/features/doctors/use-doctors'
import { useUsers } from '@/features/users/use-users'

export const Route = createFileRoute('/_app/trabajos/')({
  validateSearch: parseCasesSearch,
  component: TrabajosPage,
})

function TrabajosPage() {
  const { user } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const [importOpen, setImportOpen] = useState(false)
  const vista = search.vista ?? 'todos'
  const pagina = search.pagina ?? 1
  const hidePrices = user.role === 'tecnico' || user.role === 'mensajero'
  const canWrite = user.role === 'admin' || user.role === 'recepcion'
  // El listado de usuarios (para el filtro de técnico) es una ruta solo de admin en la API.
  const canFilterByTechnician = user.role === 'admin'

  const clinics = useClinics(false)
  const doctors = useDoctors(search.clinicId ?? '', false)
  const users = useUsers(canFilterByTechnician)
  const technicians = canFilterByTechnician
    ? (users.data ?? []).filter((u) => u.role === 'tecnico')
    : undefined

  const query: CaseListQueryInput = { ...search, vista, pagina }
  const cases = useCases(query)
  const data = cases.data
  const hasMore = data !== undefined && pagina * data.pageSize < data.total

  function updateSearch(patch: Partial<CaseListQueryInput>) {
    void navigate({ search: (prev) => ({ ...prev, ...patch, pagina: undefined }) })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Trabajos"
        action={
          canWrite ? (
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                variant="outline"
                className="h-11 flex-1 sm:flex-none"
                onClick={() => setImportOpen(true)}
              >
                Importar
              </Button>
              <Button asChild className="h-11 flex-1 sm:flex-none">
                <Link to="/trabajos/nuevo">Nuevo trabajo</Link>
              </Button>
            </div>
          ) : undefined
        }
      />
      <Tabs value={vista} onValueChange={(v) => updateSearch({ vista: v as CaseView })}>
        <div className="overflow-x-auto overflow-y-hidden">
          <TabsList>
            {CASE_VIEWS.map((v) => (
              <TabsTrigger key={v} value={v}>
                {CASE_VIEW_LABEL[v]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      <CasesFilters
        value={search}
        onChange={updateSearch}
        clinics={clinics.data ?? []}
        doctors={doctors.data ?? []}
        technicians={technicians}
      />
      {cases.isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <CasesTable rows={data?.cases ?? []} hidePrices={hidePrices} />
      )}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          className="h-11"
          disabled={pagina <= 1}
          onClick={() => void navigate({ search: (prev) => ({ ...prev, pagina: pagina - 1 }) })}
        >
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground">Página {pagina}</span>
        <Button
          variant="outline"
          className="h-11"
          disabled={!hasMore}
          onClick={() => void navigate({ search: (prev) => ({ ...prev, pagina: pagina + 1 }) })}
        >
          Siguiente
        </Button>
      </div>
      {canWrite && <ImportDialog open={importOpen} onOpenChange={setImportOpen} />}
    </div>
  )
}
