import { ACCOUNT_ADMIN_ROLES, hasRole, type UserRole } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, FileText } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/empty-state'
import { LoadError } from '@/components/load-error'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QueuedNotice } from '@/features/cases/queued-notice'
import { isNotFoundError } from '@/lib/api-error'
import { AccountSummary } from './account-summary'
import { adjustableCases } from './adjustable-cases'
import { AdjustmentDialog } from './adjustment-dialog'
import { ApplyCreditDialog } from './apply-credit-dialog'
import { BalanceBreakdown } from './balance-breakdown'
import { MovementsTable } from './movements-table'
import { OpenCasesTable } from './open-cases-table'
import type { PaymentRef } from './payment-context'
import { PaymentDialog } from './payment-dialog'
import { useAccountBusy } from './use-account-busy'
import { useClinicAccount } from './use-clinic-account'
import { VoidPaymentDialog } from './void-payment-dialog'

type OpenDialog = 'pago' | 'ajuste' | 'aplicar' | 'anular' | null

/**
 * La cuenta de una clínica (`/cuentas/$clinicaId`, CTA-1/2/3): la cabecera con el saldo, el saldo
 * a favor y la antigüedad, y las pestañas «Por cobrar» y «Movimientos», con el enlace al
 * estado de cuenta imprimible (CTA-5). Admin y recepción
 * registran pagos y aplican el saldo a favor de cada pago; solo el administrador
 * (`ACCOUNT_ADMIN_ROLES`) registra ajustes y anula pagos. Distingue «no existe» (404) de «no se
 * pudo cargar», cada uno con su `h1`.
 */
export function ClinicAccountContent({ clinicId, role }: { clinicId: string; role: UserRole }) {
  const account = useClinicAccount(clinicId)
  const { busy, queued } = useAccountBusy(clinicId)
  const [dialog, setDialog] = useState<OpenDialog>(null)
  // El pago de «Aplicar saldo a favor» o «Anular pago»; se queda al cerrar, para la animación.
  const [payment, setPayment] = useState<PaymentRef | null>(null)
  const canAdmin = hasRole(ACCOUNT_ADMIN_ROLES, role)

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

  const data = account.data
  const close = (open: boolean) => {
    if (!open) setDialog(null)
  }
  const openFor = (kind: 'aplicar' | 'anular') => (p: PaymentRef) => {
    setPayment(p)
    setDialog(kind)
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/cuentas"
        className="-my-2.5 inline-flex min-h-11 items-center gap-1 self-start text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" /> Cuentas
      </Link>
      <PageHeader
        title={data.clinic.name}
        description="Lo que debe, desde cuándo y cada pago, cargo y ajuste."
        action={
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button asChild variant="outline" className="h-11">
              <Link to="/cuentas/$clinicaId/estado" params={{ clinicaId: clinicId }}>
                <FileText aria-hidden /> Estado de cuenta
              </Link>
            </Button>
            {canAdmin && (
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={busy}
                onClick={() => setDialog('ajuste')}
              >
                Registrar ajuste
              </Button>
            )}
            <Button
              type="button"
              className="h-11"
              disabled={busy}
              onClick={() => setDialog('pago')}
            >
              Registrar pago
            </Button>
          </div>
        }
      />
      {queued && <QueuedNotice className="-mt-4" />}
      <AccountSummary
        balance={data.balance}
        credit={data.credit}
        aging={data.aging}
        oldestDays={data.oldestDays}
      />
      <Tabs defaultValue="por-cobrar">
        <TabsList>
          <TabsTrigger value="por-cobrar">Por cobrar ({data.openCases.length})</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos ({data.movements.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="por-cobrar" className="flex flex-col gap-4 pt-4">
          <OpenCasesTable rows={data.openCases} />
          <BalanceBreakdown breakdown={data.breakdown} />
        </TabsContent>
        <TabsContent value="movimientos" className="pt-4">
          <MovementsTable
            rows={data.movements}
            actions={{
              canApply: data.openCases.length > 0,
              canVoid: canAdmin,
              disabled: busy,
              onApply: openFor('aplicar'),
              onVoid: openFor('anular'),
            }}
          />
        </TabsContent>
      </Tabs>

      <PaymentDialog
        clinic={data.clinic}
        openCases={data.openCases}
        open={dialog === 'pago'}
        onOpenChange={close}
      />
      {canAdmin && (
        <AdjustmentDialog
          clinic={data.clinic}
          cases={adjustableCases(data.movements, data.openCases)}
          open={dialog === 'ajuste'}
          onOpenChange={close}
        />
      )}
      {payment && (
        <ApplyCreditDialog
          key={`aplicar-${payment.id}`}
          clinic={data.clinic}
          payment={payment}
          openCases={data.openCases}
          open={dialog === 'aplicar'}
          onOpenChange={close}
        />
      )}
      {payment && canAdmin && (
        <VoidPaymentDialog
          key={`anular-${payment.id}`}
          clinic={data.clinic}
          payment={payment}
          open={dialog === 'anular'}
          onOpenChange={close}
        />
      )}
    </div>
  )
}
