import { ASSIGN_TECHNICIAN_ROLES, canAssignTechnician, type UserRole } from '@dentalware/shared'
import { Field, FieldLabel } from '@/components/ui/field'
import type { CaseDetail } from './api'
import { useAssignTechnician, useTechnicians } from './use-cases'

/** Solo admin y recepción asignan (I-5 + M-5 + M-9, ola de fixes del PR 1:
 * `ASSIGN_TECHNICIAN_ROLES` de shared, antes una lista a mano); técnico y mensajero ven el
 * nombre pero no el control. */
function canAssign(role: UserRole): boolean {
  return (ASSIGN_TECHNICIAN_ROLES as readonly UserRole[]).includes(role)
}

/**
 * Técnico responsable del trabajo (CIC-5): admin y recepción ven un `<select>` nativo (no el
 * combobox de Radix — el mismo patrón que la barra de filtros, más simple para una lista
 * corta) con los técnicos activos (`useTechnicians`, solo consultado para estos roles: técnico
 * y mensajero recibirían 403 de `GET /api/trabajos/tecnicos`) más "Sin asignar"; el resto de
 * roles solo ve el nombre ya presente en `case.technician`, sin disparar esa consulta.
 *
 * `canAssignTechnician(status)` (I-5, ola de fixes del PR 1, lote B): un trabajo
 * `entregado`/`cancelado` ya no se reasigna (`CasesService.assignTechnician` responde 409);
 * antes el `<select>` seguía habilitado para admin/recepción en esos estados y solo el 409
 * lo impedía, sin ningún indicio en la UI de que el cambio no se iba a guardar.
 */
export function TechnicianSelect({ case: c, role }: { case: CaseDetail; role: UserRole }) {
  const canControl = canAssign(role) && canAssignTechnician(c.status)
  const technicians = useTechnicians(canControl)
  const assign = useAssignTechnician(c.id)

  if (!canControl) {
    return (
      <Field>
        {/* `htmlFor` apunta al `<p>` con `id` (no hay control que etiquetar en la rama de
         * solo lectura): sin esto, un lector de pantalla lee el nombre suelto, sin saber de
         * qué es (M-7 de la revisión de la Tarea 9). */}
        <FieldLabel htmlFor="tecnico-asignado">Técnico responsable</FieldLabel>
        <p id="tecnico-asignado" className="text-sm">
          {c.technician?.name ?? 'Sin asignar'}
        </p>
      </Field>
    )
  }

  // M-4 (ola de fixes del PR 1, lote B): el asignado se dio de baja después de asignarlo, así
  // que ya no está en `technicians.data` (solo activos, `UsersQuery.activeTechnicians`). Sin
  // esto, el `<select>` caía en "Sin asignar" (ninguna `<option>` calzaba su valor) mientras
  // la cabecera de arriba seguía mostrando su nombre — dos fuentes de verdad discrepando en
  // la misma pantalla. Se espera a que `technicians.data` haya cargado para no parpadear la
  // opción "(inactivo)" mientras la lista de activos todavía no llegó; se arma un objeto
  // `{ id, name }` (en vez de `!` sobre `assignedTechnicianId`/`technician`) para que TS
  // siga sabiendo, dentro del JSX, que ninguno de los dos es nulo.
  const assignedInactive =
    c.assignedTechnicianId &&
    c.technician &&
    technicians.data !== undefined &&
    !technicians.data.some((t) => t.id === c.assignedTechnicianId)
      ? { id: c.assignedTechnicianId, name: c.technician.name }
      : null

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
        {assignedInactive && (
          <option value={assignedInactive.id}>{assignedInactive.name} (inactivo)</option>
        )}
        {technicians.data?.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </Field>
  )
}
