import type { ReactNode } from 'react'

export type Proyecto = 'escritorio' | 'telefono'

/** Ruta fija de una captura: la tubería (`capturas/helpers.ts`) escribe exactamente aquí y
 * `capturas-referenciadas.test.ts` cruza los nombres en las dos direcciones. */
export function rutaCaptura(nombre: string, proyecto: Proyecto): string {
  return `/img/capturas/${nombre}.${proyecto}.png`
}

/** Qué variantes pinta una `<Captura>`: escritorio; con `telefono`, las dos; con `solo`, esa.
 * `capturas-referenciadas.test.ts` exige el PNG de cada una con esta misma regla. */
export function proyectosCaptura({
  telefono = false,
  solo,
}: {
  telefono?: boolean
  solo?: Proyecto
}): Proyecto[] {
  return solo ? [solo] : telefono ? ['escritorio', 'telefono'] : ['escritorio']
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
    <figure className="captura">
      <div className="captura__imagenes">
        {proyectos.map((p) => (
          <img
            key={p}
            src={rutaCaptura(nombre, p)}
            alt={p === 'telefono' && proyectos.length > 1 ? `${alt} (en el teléfono)` : alt}
            loading="lazy"
            className={`captura__img captura__img--${p}`}
          />
        ))}
      </div>
      {pie ? <figcaption>{pie}</figcaption> : null}
    </figure>
  )
}
