import { cn } from '@/lib/utils'
import { balanceParts } from './balance-text'

/** Saldo de una clínica en monoespaciada: en negrita si debe, apagado si está en cero y con
 * el rótulo «A favor» si es negativo (texto, no solo color). */
export function BalanceAmount({ balance, className }: { balance: string; className?: string }) {
  const { kind, amount } = balanceParts(balance)
  return (
    <span className={cn('whitespace-nowrap', className)}>
      {kind === 'a_favor' && (
        <>
          <span className="rounded-md bg-teal-lab-soft px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
            A favor
          </span>{' '}
        </>
      )}
      <span
        className={cn(
          'font-mono tabular-nums',
          kind === 'debe' && 'font-semibold',
          kind === 'cero' && 'text-muted-foreground',
        )}
      >
        {amount}
      </span>
    </span>
  )
}
