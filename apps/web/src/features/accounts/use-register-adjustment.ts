import type { AdjustmentInput } from '@dentalware/shared'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { mutationKeys } from '@/lib/query-keys'
import { adjustmentDoneText } from './account-done'
import { registerAdjustment } from './api'
import { useAccountMutationError } from './use-account-mutation-error'
import { useInvalidateAccounts } from './use-invalidate-accounts'

/** «Registrar ajuste» (CTA-3, solo admin). */
export function useRegisterAdjustment(clinicId: string) {
  const invalidate = useInvalidateAccounts()
  const onError = useAccountMutationError()
  return useMutation({
    mutationKey: mutationKeys.adjustment(clinicId),
    mutationFn: (input: AdjustmentInput) => registerAdjustment(input),
    onSuccess: async (ajuste) => {
      await invalidate()
      toast.success(adjustmentDoneText(ajuste.released))
    },
    onError,
  })
}
