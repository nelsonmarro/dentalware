import type { VoidPaymentInput } from '@dentalware/shared'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { mutationKeys } from '@/lib/query-keys'
import { voidPayment } from './api'
import { useAccountMutationError } from './use-account-mutation-error'
import { useInvalidateAccounts } from './use-invalidate-accounts'

/** «Anular pago» (CTA-2, solo admin, decisión 2). */
export function useVoidPayment(clinicId: string) {
  const invalidate = useInvalidateAccounts()
  const onError = useAccountMutationError()
  return useMutation({
    mutationKey: mutationKeys.voidPayment(clinicId),
    mutationFn: ({ paymentId, input }: { paymentId: string; input: VoidPaymentInput }) =>
      voidPayment(paymentId, input),
    onSuccess: async () => {
      await invalidate()
      toast.success('Pago anulado')
    },
    onError,
  })
}
