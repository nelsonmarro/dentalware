import type { UserRole } from '@dentalware/shared'
import { MyCases } from './my-cases'
import { SummaryCards } from './summary-cards'

/**
 * Contenido del panel de inicio que depende del rol (INI-1 + INI-2, Tarea 12; M-4, ronda de
 * fixes 1): contadores para todos los roles con sesión, "Mis trabajos" solo para técnico
 * (tercer criterio de aceptación de CIC-5). Vive en `features/cases` (no en `routes/`, que no
 * tiene archivos de test en este proyecto) para poder probar la condición de rol como
 * cualquier otro componente de features, en vez de dejarla sin cubrir dentro de la ruta.
 */
export function HomeSummary({ role, technicianId }: { role: UserRole; technicianId: string }) {
  return (
    <>
      <SummaryCards />
      {role === 'tecnico' && <MyCases technicianId={technicianId} />}
    </>
  )
}
