import type { ApplyCreditInput } from '@dentalware/shared'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { mutationKeys } from '@/lib/query-keys'
import { creditDoneText } from './account-done'
import { applyCredit } from './api'
import { useAccountMutationError } from './use-account-mutation-error'
import { useInvalidateAccounts } from './use-invalidate-accounts'

/** «Aplicar saldo a favor» de un pago (CTA-2, decisión 3). El aviso nombra los trabajos que
 * cerró la API (`settled`, UX5-04). */
export function useApplyCredit(clinicId: string) {
  const invalidate = useInvalidateAccounts()
  const onError = useAccountMutationError()
  return useMutation({
    mutationKey: mutationKeys.applyCredit(clinicId),
    mutationFn: ({ paymentId, input }: { paymentId: string; input: ApplyCreditInput }) =>
      applyCredit(paymentId, input),
    onSuccess: async (pago) => {
      await invalidate()
      toast.success(creditDoneText(pago.settled))
    },
    onError,
  })
}
