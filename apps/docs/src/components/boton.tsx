import type { ReactNode } from 'react'

/** El texto de un botón o enlace de la app, tal cual sale en ella (regla de redacción del spec). */
export function Boton({ children }: { children: ReactNode }) {
  return <kbd className="boton">{children}</kbd>
}
