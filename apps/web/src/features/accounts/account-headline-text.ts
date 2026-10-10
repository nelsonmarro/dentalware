import { fromCents, type AccountPending } from '@dentalware/shared'
import { formatMoney } from '@/lib/format-money'
import { daysText } from './days-text'

/** «1 trabajo por cobrar ($ 75.00), cubierto …» o «2 trabajos …, cubiertos …». */
function openCasesText(count: number, cents: number, participle: string, by: string): string {
  const many = count === 1 ? '' : 's'
  return `${count} trabajo${many} por cobrar (${formatMoney(fromCents(cents))}), ${participle}${many} por ${by}`
}

/** La línea bajo el saldo de la cuenta (UX5-01): «Nada pendiente» solo sin trabajos por cobrar.
 * El `switch` es exhaustivo: un caso nuevo no compila sin su texto. */
export function pendingText(pending: AccountPending): string {
  switch (pending.kind) {
    case 'nada':
      return 'Nada pendiente'
    case 'vencido':
      return `Más antiguo: ${daysText(pending.oldestDays)}`
    case 'cubierto':
      return openCasesText(pending.count, pending.cents, 'cubierto', 'el saldo a favor')
    case 'compensado':
      return openCasesText(pending.count, pending.cents, 'compensado', 'ajustes sin trabajo')
  }
}
