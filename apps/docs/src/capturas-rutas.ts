/** Rutas y variantes de las capturas del manual, sin dependencias de Docusaurus ni de React: las
 * importan el componente `Captura`, la tubería de Playwright (`capturas/helpers.ts`, que corre en
 * Node, donde `@docusaurus/useBaseUrl` no existe) y `capturas-referenciadas.test.ts`. */

export const PROYECTOS = ['escritorio', 'telefono'] as const
export type Proyecto = (typeof PROYECTOS)[number]

export function esProyecto(nombre: string): nombre is Proyecto {
  return (PROYECTOS as readonly string[]).includes(nombre)
}

/** Ruta fija de una captura bajo `static/`: la tubería escribe exactamente aquí y
 * `capturas-referenciadas.test.ts` cruza los nombres de specs, guías y PNG. */
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
