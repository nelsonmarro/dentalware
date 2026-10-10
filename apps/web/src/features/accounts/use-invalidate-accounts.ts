import { useQueryClient } from '@tanstack/react-query'

/**
 * Lo que refresca una mutación de cuentas: `['cuentas']` (la lista y la cuenta de la clínica) y
 * `['trabajos']` (el estado `entregado ⇄ cobrado`, la línea de cobro de la ficha y su historial).
 * Se espera entera: el botón sigue ocupado hasta que la pantalla muestra el saldo nuevo.
 */
export function useInvalidateAccounts() {
  const qc = useQueryClient()
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['cuentas'] }),
      qc.invalidateQueries({ queryKey: ['trabajos'] }),
    ])
  }
}
