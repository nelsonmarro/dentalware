import type { UserRole } from '@dentalware/shared'

/** Los rótulos de la app (`apps/web/src/features/users/role-label.ts`). */
const ROL_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  recepcion: 'Recepción',
  tecnico: 'Técnico',
  mensajero: 'Mensajero',
}

/** El MDX no pasa por `tsc`: un rol mal escrito (`'recepción'`) llega aquí y, en vez de pintar un
 * chip vacío, rompe el build (SSR) con un mensaje que dice qué valores valen. */
function rotulo(rol: UserRole): string {
  const label: string | undefined = ROL_LABEL[rol]
  if (label === undefined) {
    throw new Error(
      `Rol desconocido en <Rol>: «${rol}». Usa admin, recepcion, tecnico o mensajero.`,
    )
  }
  return label
}

export function Rol({ roles }: { roles: readonly UserRole[] }) {
  return (
    <ul className="rol" aria-label="Quién puede hacerlo">
      {roles.map((r) => (
        <li key={r} className="rol__chip">
          {rotulo(r)}
        </li>
      ))}
    </ul>
  )
}
