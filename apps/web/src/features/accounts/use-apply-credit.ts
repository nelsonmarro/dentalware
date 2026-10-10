import type { ApplyCreditInput } from '@dentalware/shared'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { mutationKeys } from '@/lib/query-keys'
import { creditDoneText } from './account-done'
import { settledCount } from './allocation'
import { applyCredit } from './api'
import { useAccountMutationError } from './use-account-mutation-error'
import { useInvalidateAccounts } from './use-invalidate-accounts'

/** «Aplicar saldo a favor» de un pago (CTA-2, decisión 3). */
export function useApplyCredit(
  clinicId: string,
  open: readonly { id: string; code: string; deliveredAt: string; outstanding: string }[],
) {
  const invalidate = useInvalidateAccounts()
  const onError = useAccountMutationError()
  return useMutation({
    mutationKey: mutationKeys.applyCredit(clinicId),
    mutationFn: ({ paymentId, input }: { paymentId: string; input: ApplyCreditInput }) =>
      applyCredit(paymentId, input),
    onSuccess: async (_pago, { input }) => {
      await invalidate()
      toast.success(creditDoneText(settledCount(open, input.asignaciones)))
    },
    onError,
  })
}
