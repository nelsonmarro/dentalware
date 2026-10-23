import useBaseUrl from '@docusaurus/useBaseUrl'
import type { ReactNode } from 'react'
import { proyectosCaptura, rutaCaptura, type Proyecto } from '../capturas-rutas'

/** Una variante: la tubería la toma a `deviceScaleFactor: 2`, así que se declara `2x` y el
 * navegador la pinta a la mitad de sus píxeles (su tamaño real en la app, nítida en retina). Solo
 * `srcSet`, sin `src`: el `src` cuenta como candidata `1x` y una pantalla normal la elegiría,
 * pintándola al doble. La ruta pasa por `useBaseUrl` por si el sitio se publica bajo otra base. */
function CapturaImg({ ruta, alt, proyecto }: { ruta: string; alt: string; proyecto: Proyecto }) {
  const src = useBaseUrl(ruta)
  return (
    <img
      srcSet={`${src} 2x`}
      alt={alt}
      loading="lazy"
      className={`captura__img captura__img--${proyecto}`}
    />
  )
}

export function Captura({
  nombre,
  alt,
  telefono = false,
  solo,
  pie,
}: {
  /** `<seccion>/<nombre>`, sin extensión ni proyecto. */
  nombre: string
  alt: string
  /** Añade la variante de teléfono al lado de la de escritorio. */
  telefono?: boolean
  /** Solo una de las dos. */
  solo?: Proyecto
  pie?: ReactNode
}) {
  const proyectos = proyectosCaptura({ telefono, solo })
  return (
    // `captura--doble`: en el teléfono se ve solo la variante del teléfono (`custom.css`).
    <figure className={proyectos.length > 1 ? 'captura captura--doble' : 'captura'}>
      <div className="captura__imagenes">
        {proyectos.map((p) => (
          <CapturaImg
            key={p}
            ruta={rutaCaptura(nombre, p)}
            alt={p === 'telefono' && proyectos.length > 1 ? `${alt} (en el teléfono)` : alt}
            proyecto={p}
          />
        ))}
      </div>
      {pie ? <figcaption>{pie}</figcaption> : null}
    </figure>
  )
}
