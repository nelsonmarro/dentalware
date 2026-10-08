import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { LoadError } from '@/components/load-error'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { isNotFoundError } from '@/lib/api-error'
import { BalanceAmount } from './balance-amount'
import { useClinicAccount } from './use-clinic-account'

/**
 * La cuenta de una clínica (`/cuentas/$clinicaId`). Por ahora, su nombre y su saldo; los
 * movimientos, «Por cobrar», pagos y ajustes llegan con CTA-2 y CTA-3. Distingue «no existe»
 * (404) de «no se pudo cargar», cada uno con su `h1`.
 */
export function ClinicAccountContent({ clinicId }: { clinicId: string }) {
  const account = useClinicAccount(clinicId)

  if (account.isPending) return <p className="text-sm text-muted-foreground">Cargando…</p>
  if (account.isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Cuenta" />
        {isNotFoundError(account.error) ? (
          <EmptyState
            title="La clínica no existe"
            action={
              <Button asChild className="h-11">
                <Link to="/cuentas">Volver a cuentas</Link>
              </Button>
            }
          />
        ) : (
          <LoadError onRetry={() => void account.refetch()} autoFocus />
        )}
      </div>
    )
  }

  const { clinic, balance } = account.data
  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/cuentas"
        className="-my-2.5 inline-flex min-h-11 items-center gap-1 self-start text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" /> Cuentas
      </Link>
      <PageHeader title={clinic.name} />
      <div className="flex flex-col gap-1 self-start rounded-xl border border-border bg-card px-4 py-3">
        <span className="text-sm text-muted-foreground">Saldo</span>
        <BalanceAmount balance={balance} className="text-2xl" />
      </div>
    </div>
  )
}
