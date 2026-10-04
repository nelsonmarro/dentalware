import {
  compareStopDeliveries,
  deliveryDaySummary,
  isActionableDelivery,
  toIsoDate,
  type UserRole,
} from '@dentalware/shared'
import { EmptyState } from '@/components/empty-state'
import { LoadError } from '@/components/load-error'
import type { DeliveryItem } from './api'
import { ClinicGroup } from './clinic-group'
import { useDeliveries } from './use-deliveries'

type Group = { clinic: DeliveryItem['clinic']; deliveries: DeliveryItem[] }

/** Agrupa por clínica, en orden alfabético (como recorre la ruta quien la lee en papel), y
 * ordena cada parada con `compareStopDeliveries` (shared): lo que queda por hacer primero, y de
 * eso lo urgente, luego lo atrasado y luego por fecha (UX4-19); lo cerrado al final. */
function groupByClinic(items: DeliveryItem[], today: string): Group[] {
  const groups = new Map<string, Group>()
  for (const d of items) {
    const g = groups.get(d.clinic.id) ?? { clinic: d.clinic, deliveries: [] }
    g.deliveries.push(d)
    groups.set(d.clinic.id, g)
  }
  return [...groups.values()]
    .sort((a, b) => a.clinic.name.localeCompare(b.clinic.name, 'es'))
    .map((g) => ({
      ...g,
      deliveries: [...g.deliveries].sort((a, b) => compareStopDeliveries(a, b, today)),
    }))
}

/**
 * Recogidas y entregas de un día, agrupadas por clínica (ENT-5). Lista simple sin orden,
 * filtro ni paginación propios, así que no usa `DataGrid` (`docs/data-grid.md`): grupos de
 * tarjetas, iguales en escritorio y en móvil. `compact` (inicio del mensajero, #105): solo lo
 * pendiente, sin el resumen del día. Un fallo al cargar es «no se pudo cargar», nunca un vacío.
 */
export function DeliveriesDay({
  day,
  courierId,
  role,
  userId,
  compact = false,
}: {
  day: string
  courierId?: string
  role: UserRole
  /** Quien usa la app: el mensajero solo ve acciones sobre sus propias entregas. */
  userId: string
  compact?: boolean
}) {
  const today = toIsoDate(new Date())
  const q = useDeliveries(day, courierId)

  if (q.isPending) {
    // Sin red la consulta queda en pausa (`fetchStatus: 'paused'`) y «Cargando…» no terminaría
    // nunca: se dice que espera la señal (UX4-26). Al volver la red se carga sola.
    return (
      <p className="text-sm text-muted-foreground">
        {q.fetchStatus === 'paused'
          ? 'Sin conexión: este día se cargará al volver la señal.'
          : 'Cargando…'}
      </p>
    )
  }
  if (q.isError) return <LoadError onRetry={() => void q.refetch()} />

  const items = compact ? q.data.filter(isActionableDelivery) : q.data
  if (items.length === 0) {
    const mineToday = role === 'mensajero' && day === today
    // En compacto, que no quede nada pendiente no es lo mismo que no haber tenido entregas.
    const allDone = compact && q.data.length > 0
    return (
      <EmptyState
        title={
          allDone
            ? 'Terminaste las entregas de hoy.'
            : mineToday
              ? 'No tienes entregas hoy'
              : 'No hay entregas ni recogidas este día.'
        }
      />
    )
  }

  return (
    <div className="flex max-w-4xl min-w-0 flex-col gap-4">
      {!compact && (
        // UX4-18: también lo que no se pudo y lo anulado, para que el día cuadre.
        <p className="text-sm text-muted-foreground">{deliveryDaySummary(items, today)}</p>
      )}
      {groupByClinic(items, today).map((g) => (
        <ClinicGroup
          key={g.clinic.id}
          clinic={g.clinic}
          deliveries={g.deliveries}
          role={role}
          userId={userId}
          today={today}
        />
      ))}
    </div>
  )
}
