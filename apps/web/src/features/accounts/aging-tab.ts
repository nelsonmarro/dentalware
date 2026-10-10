import { agingBucketForDays, type AgingBucket } from '@dentalware/shared'

/** Pestaña de color de una cuenta (la firma del ticket, dirección de diseño §4): el cubo de lo
 * más antiguo que debe la clínica, o `al_dia` si no debe nada. */
export type AgingTab = AgingBucket | 'al_dia'

export function agingTab(oldestDays: number | null): AgingTab {
  return oldestDays === null ? 'al_dia' : agingBucketForDays(oldestDays)
}

/** Color de la pestaña. Solo acompaña: lo dice el texto «Más antiguo: N días» (nunca solo
 * color). `Record` exhaustivo: un cubo nuevo no compila sin decidir su color. */
export const AGING_TAB_COLOR: Record<AgingTab, string> = {
  al_dia: 'var(--border)',
  '0_30': 'var(--muted-foreground)',
  '31_60': 'var(--wax-amber)',
  '61_90': 'var(--articulating-red)',
  '90_mas': 'var(--destructive)',
}
