import type { PaymentInput } from '@dentalware/shared'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { mutationKeys } from '@/lib/query-keys'
import { paymentDoneText } from './account-done'
import { registerPayment } from './api'
import { useAccountMutationError } from './use-account-mutation-error'
import { useInvalidateAccounts } from './use-invalidate-accounts'

/** «Registrar pago» (CTA-2). El aviso nombra los trabajos que cerró la API (`settled`, UX5-04),
 * no los que el reparto parecía cubrir al abrir el diálogo. */
export function useRegisterPayment(clinicId: string) {
  const invalidate = useInvalidateAccounts()
  const onError = useAccountMutationError()
  return useMutation({
    mutationKey: mutationKeys.payment(clinicId),
    mutationFn: (input: PaymentInput) => registerPayment(input),
    onSuccess: async (pago) => {
      await invalidate()
      toast.success(paymentDoneText(pago.settled, pago.credit))
    },
    onError,
  })
}
