import type { PaymentInput } from '@dentalware/shared'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { mutationKeys } from '@/lib/query-keys'
import { paymentDoneText } from './account-done'
import { settledCount } from './allocation'
import { registerPayment } from './api'
import { useAccountMutationError } from './use-account-mutation-error'
import { useInvalidateAccounts } from './use-invalidate-accounts'

/** «Registrar pago» (CTA-2). `open` son los trabajos «Por cobrar» que ve el diálogo: con ellos
 * el aviso dice cuántos quedaron cobrados. */
export function useRegisterPayment(
  clinicId: string,
  open: readonly { id: string; code: string; deliveredAt: string; outstanding: string }[],
) {
  const invalidate = useInvalidateAccounts()
  const onError = useAccountMutationError()
  return useMutation({
    mutationKey: mutationKeys.payment(clinicId),
    mutationFn: (input: PaymentInput) => registerPayment(input),
    onSuccess: async (pago, input) => {
      await invalidate()
      toast.success(paymentDoneText(settledCount(open, input.asignaciones), pago.credit))
    },
    onError,
  })
}
