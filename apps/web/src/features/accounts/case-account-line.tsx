import {
  ACCOUNTS_ROLES,
  caseOutstandingCents,
  fromSignedCents,
  hasRole,
  toSignedCents,
  type CaseAccount,
  type UserRole,
} from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { CircleCheck, Wallet } from 'lucide-react'
import { formatTimestampDayMonth } from '@/features/cases/date-format'
import { formatMoney } from '@/lib/format-money'
import { signedAmountText } from './balance-text'

const Money = ({ value }: { value: string }) => (
  <span className="font-mono tabular-nums">{formatMoney(value)}</span>
)

/**
 * La cuenta del trabajo en su ficha (Iteración 5), para admin y recepción: «Cobrado el dd/mm» o
 * «Pendiente $X de $Y» (Y = lo que se debe por él: cargo más sus ajustes), con enlace a la cuenta
 * de la clínica. De una repetición que no se cobra entera aclara lo que se cobra, porque el
 * «Total» de la cabecera es el precio de sus líneas; y si el trabajo tiene ajustes, los dice con
 * signo y cómo cambian lo que se cobra (UX5-16), porque si no «de $Y» no cuadra con el «Total».
 *
 * A técnico y mensajero la API les manda `account: null`; el rol se vuelve a mirar por si acaso.
 */
export function CaseAccountLine({
  account,
  clinicId,
  total,
  remakeChargePct,
  role,
}: {
  account: CaseAccount | null
  clinicId: string
  total: string
  remakeChargePct: string | number | null
  role: UserRole
}) {
  if (!account || !hasRole(ACCOUNTS_ROLES, role)) return null
  const net = fromSignedCents(
    caseOutstandingCents(toSignedCents(account.charge), toSignedCents(account.adjustments), 0),
  )
  const adjusted = toSignedCents(account.adjustments) !== 0
  const reducedRemake =
    remakeChargePct !== null && toSignedCents(account.charge) !== toSignedCents(total)

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex items-center gap-2 text-sm font-medium">
          {account.paidAt ? (
            <>
              <CircleCheck aria-hidden className="size-4 shrink-0 text-ok-green" />
              Cobrado el {formatTimestampDayMonth(account.paidAt)}
            </>
          ) : (
            <>
              <Wallet aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span>
                Pendiente <Money value={account.outstanding} /> de <Money value={net} />
              </span>
            </>
          )}
        </p>
        {adjusted && (
          <p className="text-sm text-muted-foreground">
            Incluye ajustes de{' '}
            <span className="font-mono tabular-nums">{signedAmountText(account.adjustments)}</span>
            : se cobra <Money value={net} /> en vez de <Money value={account.charge} />
          </p>
        )}
        {reducedRemake && (
          <p className="text-sm text-muted-foreground">
            Repetición al {Number(remakeChargePct)} %: se cobra <Money value={account.charge} />, no
            el total de <Money value={total} />
          </p>
        )}
      </div>
      <Link
        to="/cuentas/$clinicaId"
        params={{ clinicaId: clinicId }}
        className="inline-flex min-h-11 shrink-0 items-center text-sm text-primary underline underline-offset-2"
      >
        Ver cuenta de la clínica
      </Link>
    </div>
  )
}
