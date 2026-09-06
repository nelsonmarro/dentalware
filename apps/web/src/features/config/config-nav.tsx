import { Link } from '@tanstack/react-router'

const SECTIONS = [
  { to: '/configuracion/laboratorio', label: 'Laboratorio' },
  { to: '/configuracion/usuarios', label: 'Usuarios' },
  { to: '/configuracion/clinicas', label: 'Clínicas' },
  { to: '/configuracion/productos', label: 'Productos' },
  { to: '/configuracion/fases', label: 'Fases' },
] as const

export function ConfigNav() {
  return (
    <nav
      aria-label="Secciones de configuración"
      className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0"
    >
      <ul className="flex gap-2">
        {SECTIONS.map((s) => (
          <li key={s.to}>
            <Link
              to={s.to}
              className="inline-flex h-11 items-center rounded-lg px-4 text-sm whitespace-nowrap text-muted-foreground transition-colors duration-150 hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
              activeProps={{ className: 'bg-accent text-accent-foreground font-medium' }}
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
