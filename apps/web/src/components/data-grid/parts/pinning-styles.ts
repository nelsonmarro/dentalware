import type { CSSProperties } from 'react'
import type { GridColumn } from '../types'

/** Estilos sticky para columnas fijadas. Sin feature `pinning` devuelve `{}`. */
export function pinningStyles(_column: GridColumn<never>, hasPinning: boolean): CSSProperties {
  if (!hasPinning) return {}
  return {}
}
