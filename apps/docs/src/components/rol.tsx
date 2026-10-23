import type { UserRole } from '@dentalware/shared'

const ROL_LABEL: Record<UserRole, string> = {
  admin: 'Administración',
  recepcion: 'Recepción',
  tecnico: 'Técnico',
  mensajero: 'Mensajero',
}

export function Rol({ roles }: { roles: readonly UserRole[] }) {
  return (
    <ul className="rol" aria-label="Quién puede hacerlo">
      {roles.map((r) => (
        <li key={r} className="rol__chip">
          {ROL_LABEL[r]}
        </li>
      ))}
    </ul>
  )
}
