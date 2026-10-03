import { hidesPrices } from './roles.ts'
import type { UserRole } from './roles.ts'

/**
 * Copias de la orden de trabajo impresa (spec §5, UX3-21, decisión de producto de la ola de
 * fixes de la Iteración 3): la **copia laboratorio** acompaña al trabajo hasta el banco del
 * técnico y nunca lleva precios; la **copia clínica** sí los lleva. El orden es el de impresión
 * cuando se imprimen ambas.
 */
export const PRINT_COPIES = ['laboratorio', 'clinica'] as const
export type PrintCopy = (typeof PRINT_COPIES)[number]

/** `Record` exhaustivo: una copia nueva no compila hasta decidir si lleva precios. */
const PRINT_COPY_PRICES: Record<PrintCopy, boolean> = {
  laboratorio: false,
  clinica: true,
}

export const PRINT_COPY_LABEL: Record<PrintCopy, string> = {
  laboratorio: 'Copia laboratorio',
  clinica: 'Copia clínica',
}

export function printCopyShowsPrices(copy: PrintCopy): boolean {
  return PRINT_COPY_PRICES[copy]
}

/** Copias que puede imprimir un rol: quien no recibe precios (`hidesPrices`, ADR 31) solo
 * imprime las copias sin precios — ni siquiera ve una «Copia clínica» vacía. */
export function printCopiesFor(role: UserRole): PrintCopy[] {
  return PRINT_COPIES.filter((copy) => !printCopyShowsPrices(copy) || !hidesPrices(role))
}
