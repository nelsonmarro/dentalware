import { toIsoDate } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { LoadError } from '@/components/load-error'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useLabSettings } from '@/features/config/use-lab-settings'
import { isNotFoundError } from '@/lib/api-error'
import { AccountStatement } from './account-statement'
import { StatementRangeForm } from './statement-range-form'
import { useAccountStatement } from './use-account-statement'

type Range = { desde: string; hasta: string }

/**
 * Pantalla del estado de cuenta (`/cuentas/$clinicaId/estado`, CTA-5): los controles (volver,
 * periodo e «Imprimir», que no se imprimen) y el estado imprimible con el encabezado del
 * laboratorio (CFG-1). El periodo vive en la URL: `onRangeChange` navega. Distingue «no existe»
 * (404) de «no se pudo cargar».
 */
export function AccountStatementPage({
  clinicId,
  range,
  onRangeChange,
}: {
  clinicId: string
  range: Range
  onRangeChange: (range: Range) => void
}) {
  const statement = useAccountStatement(clinicId, range)
  const settings = useLabSettings()

  const back = (
    <Link
      to="/cuentas/$clinicaId"
      params={{ clinicaId: clinicId }}
      className="-my-2.5 inline-flex min-h-11 items-center gap-1 self-start text-sm text-muted-foreground hover:underline print:hidden"
    >
      <ArrowLeft aria-hidden className="size-4" /> Volver a la cuenta
    </Link>
  )

  if (statement.isPending || settings.isPending) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>
  }
  if (statement.isError || settings.isError) {
    const notFound = statement.isError && isNotFoundError(statement.error)
    return (
      <div className="flex flex-col gap-6">
        {back}
        {notFound ? (
          <EmptyState
            title="La clínica no existe"
            pageTitle
            action={
              <Button asChild className="h-11">
                <Link to="/cuentas">Volver a cuentas</Link>
              </Button>
            }
          />
        ) : (
          <>
            <PageHeader title="Estado de cuenta" />
            <LoadError
              autoFocus
              onRetry={() => {
                if (statement.isError) void statement.refetch()
                if (settings.isError) void settings.refetch()
              }}
            />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 print:block">
      <div className="flex flex-col gap-4 print:hidden">
        <div className="flex items-center justify-between gap-4">
          {back}
          <Button type="button" className="h-11" onClick={() => window.print()}>
            <Printer aria-hidden /> Imprimir
          </Button>
        </div>
        <StatementRangeForm
          key={`${range.desde}_${range.hasta}`}
          range={range}
          onSubmit={onRangeChange}
        />
      </div>
      <AccountStatement
        statement={statement.data}
        lab={settings.data ?? null}
        issuedOn={toIsoDate(new Date())}
      />
    </div>
  )
}
