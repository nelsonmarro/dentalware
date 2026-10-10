import { ApiError, toastApiError } from '@/lib/api-error'
import { useInvalidateAccounts } from './use-invalidate-accounts'

/**
 * `onError` de las mutaciones de cuentas. Un 422 no se avisa aquí: el diálogo lo pinta bajo su
 * campo. Un 409 (el pago ya estaba anulado, o la cuenta cambió mientras tanto) dice que la
 * pantalla está vieja: se espera la invalidación y después se avisa, como en los trabajos
 * (`docs/conventions.md` §5). El resto, aviso sin refrescar.
 */
export function useAccountMutationError() {
  const invalidate = useInvalidateAccounts()
  return async (error: unknown) => {
    if (error instanceof ApiError && error.status === 422) return
    if (error instanceof ApiError && error.status === 409) await invalidate()
    toastApiError(error)
  }
}
