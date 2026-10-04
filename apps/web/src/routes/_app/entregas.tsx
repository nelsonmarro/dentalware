import { DELIVERY_MANAGE_ROLES, DELIVERY_ROLES, hasRole, toIsoDate } from '@dentalware/shared'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { PageHeader } from '@/components/page-header'
import { CourierSelect } from '@/features/deliveries/courier-select'
import { DayPicker } from '@/features/deliveries/day-picker'
import { DeliveriesDay } from '@/features/deliveries/deliveries-day'
import { parseDeliveriesSearch } from '@/features/deliveries/deliveries-search'

export const Route = createFileRoute('/_app/entregas')({
  // `GET /api/entregas` es de DELIVERY_ROLES: el técnico vuelve al inicio en vez de ver un
  // error que «Reintentar» no arregla (I-1, revisión de la Tarea 7).
  beforeLoad: ({ context }) => {
    if (!hasRole(DELIVERY_ROLES, context.user.role)) throw redirect({ to: '/' })
  },
  validateSearch: parseDeliveriesSearch,
  component: EntregasPage,
})

/**
 * «Entregas» (ENT-5): la ruta del día agrupada por clínica. Día y mensajero viven en la URL
 * (`validateSearch` tolerante). Admin y recepción filtran por mensajero; el mensajero ve solo
 * lo suyo (lo fuerza la API). La ruta solo compone: el resto vive en `features/deliveries`.
 */
function EntregasPage() {
  const { user } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const day = search.dia ?? toIsoDate(new Date())
  const manages = hasRole(DELIVERY_MANAGE_ROLES, user.role)

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title="Entregas" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <DayPicker
          day={day}
          onChange={(dia) => void navigate({ search: (prev) => ({ ...prev, dia }) })}
        />
        {manages && (
          <div className="w-full lg:w-64">
            <CourierSelect
              id="entregas-mensajero"
              value={search.mensajeroId ?? ''}
              allLabel="Todos los mensajeros"
              onChange={(mensajeroId) =>
                void navigate({
                  search: (prev) => ({ ...prev, mensajeroId: mensajeroId || undefined }),
                })
              }
            />
          </div>
        )}
      </div>
      <DeliveriesDay
        day={day}
        courierId={manages ? search.mensajeroId : undefined}
        role={user.role}
      />
    </div>
  )
}
