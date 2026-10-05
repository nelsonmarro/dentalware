import { DELIVERY_MANAGE_ROLES, hasRole, type UserRole } from '@dentalware/shared'
import { DeliveriesTodayCard } from '@/features/deliveries/deliveries-today-card'
import { MyDeliveriesToday } from '@/features/deliveries/my-deliveries-today'
import { MyCases } from './my-cases'
import { SummaryCards } from './summary-cards'

/**
 * Contenido del panel de inicio que depende del rol (INI-1 + INI-2, Tarea 12; M-4, ronda de
 * fixes 1): contadores para todos los roles con sesión, "Mis trabajos" solo para técnico
 * (tercer criterio de aceptación de CIC-5) y antes que los contadores (UX3-28). Vive en `features/cases` (no en `routes/`, que no
 * tiene archivos de test en este proyecto) para poder probar la condición de rol como
 * cualquier otro componente de features, en vez de dejarla sin cubrir dentro de la ruta.
 *
 * El mensajero (INI-3, #105) ve sus entregas de hoy **en lugar de** los contadores: no le
 * dicen qué hacer. `role === 'mensajero'` es identidad (quién es), no un permiso. Quien
 * administra entregas (`DELIVERY_MANAGE_ROLES`) suma la tarjeta de las entregas de hoy junto a
 * los contadores (UX4-22).
 */
export function HomeSummary({ role, userId }: { role: UserRole; userId: string }) {
  if (role === 'mensajero') return <MyDeliveriesToday userId={userId} />
  return (
    <>
      {/* UX3-28: el técnico abre su inicio con lo suyo; los contadores del laboratorio,
          después (a 390 px empujaban «Mis trabajos» bajo el pliegue). */}
      {role === 'tecnico' && <MyCases technicianId={userId} />}
      <SummaryCards
        extra={hasRole(DELIVERY_MANAGE_ROLES, role) ? <DeliveriesTodayCard /> : undefined}
      />
    </>
  )
}
