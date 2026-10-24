import Link from '@docusaurus/Link'

type Acceso = { titulo: string; texto: string; to: string }

const ACCESOS: readonly Acceso[] = [
  {
    titulo: 'Primeros pasos',
    texto: 'Entrar, instalar la app y qué ve cada rol.',
    to: '/primeros-pasos/',
  },
  {
    titulo: 'Soy recepción',
    texto: 'Crear trabajos, seguirlos, entregarlos y cobrarlos.',
    to: '/recepcion/',
  },
  {
    titulo: 'Soy técnico',
    texto: 'Mis trabajos, fases, fotos y finalizar.',
    to: '/tecnico/',
  },
  {
    titulo: 'Soy mensajero',
    texto: 'Recogidas y entregas del día, desde el teléfono.',
    to: '/mensajero/',
  },
  {
    titulo: 'Administro el laboratorio',
    texto: 'Clínicas, productos, fases, usuarios y cuentas.',
    to: '/administracion/',
  },
]

/** Los accesos de la portada (`docs/index.md`): primeros pasos y uno por rol. */
export function Portada() {
  return (
    <ul className="portada">
      {ACCESOS.map((a) => (
        <li key={a.titulo}>
          <Link className="portada__acceso" to={a.to}>
            <span className="portada__titulo">
              {a.titulo}
              <span className="portada__flecha" aria-hidden="true">
                →
              </span>
            </span>{' '}
            <span className="portada__texto">{a.texto}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
