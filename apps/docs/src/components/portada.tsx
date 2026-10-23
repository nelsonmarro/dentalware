import Link from '@docusaurus/Link'

type Acceso = { titulo: string; texto: string; to: string }

// «Soy mensajero» apunta a «Entrar y salir» hasta que la Tarea 6 escriba su sección: un enlace
// roto rompe el build.
const ACCESOS: readonly Acceso[] = [
  {
    titulo: 'Primeros pasos',
    texto: 'Entrar, instalar la app y qué ve cada rol.',
    to: '/primeros-pasos/entrar-y-salir/',
  },
  {
    titulo: 'Soy recepción',
    texto: 'Crear trabajos, seguirlos, entregarlos y cobrarlos.',
    to: '/recepcion/',
  },
  {
    titulo: 'Soy mensajero',
    texto: 'Recogidas y entregas del día, desde el teléfono.',
    to: '/primeros-pasos/entrar-y-salir/',
  },
]

/** Los accesos por rol de la portada (`docs/index.md`). */
export function Portada() {
  return (
    <ul className="portada">
      {ACCESOS.map((a) => (
        <li key={a.titulo}>
          <Link className="portada__acceso" to={a.to}>
            <span className="portada__titulo">{a.titulo}</span>
            <span className="portada__texto">{a.texto}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
