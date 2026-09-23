import type { UserRole } from '@dentalware/shared'
import { Field, FieldLabel } from '@/components/ui/field'
import type { CaseDetail } from './api'
import { useAssignTechnician, useTechnicians } from './use-cases'

/** Solo admin y recepción asignan (mismo criterio que `canWrite` en `routes.ts`); técnico y
 * mensajero ven el nombre pero no el control. */
function canAssign(role: UserRole): boolean {
  return role === 'admin' || role === 'recepcion'
}

/**
 * Técnico responsable del trabajo (CIC-2): admin y recepción ven un `<select>` nativo (no el
 * combobox de Radix — el mismo patrón que la barra de filtros, más simple para una lista
 * corta) con los técnicos activos (`useTechnicians`, solo consultado para estos roles: técnico
 * y mensajero recibirían 403 de `GET /api/trabajos/tecnicos`) más "Sin asignar"; el resto de
 * roles solo ve el nombre ya presente en `case.technician`, sin disparar esa consulta.
 */
export function TechnicianSelect({ case: c, role }: { case: CaseDetail; role: UserRole }) {
  const canControl = canAssign(role)
  const technicians = useTechnicians(canControl)
  const assign = useAssignTechnician(c.id)

  if (!canControl) {
    return (
      <Field>
        <FieldLabel>Técnico responsable</FieldLabel>
        <p className="text-sm">{c.technician?.name ?? 'Sin asignar'}</p>
      </Field>
    )
  }

  return (
    <Field>
      <FieldLabel htmlFor="technician-select">Técnico responsable</FieldLabel>
      <select
        id="technician-select"
        className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        value={c.assignedTechnicianId ?? ''}
        disabled={assign.isPending}
        onChange={(e) => assign.mutate({ tecnicoId: e.target.value || null })}
      >
        <option value="">Sin asignar</option>
        {technicians.data?.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </Field>
  )
}
