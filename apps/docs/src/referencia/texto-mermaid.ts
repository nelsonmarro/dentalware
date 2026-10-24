import type { Estados } from './estados'

/** Dentro de una cadena de Mermaid (`["…"]`, `|"…"|`), una comilla la cerraría: va como entidad. */
const escapar = (texto: string) => texto.replaceAll('"', '#quot;')

/** El diagrama de `<Estados />`: un nodo por estado y una flecha por cada origen de cada acción.
 * «Cancelar trabajo» sale de casi todos los estados: como flechas taparía el diagrama, así que va
 * en la nota y en la tabla. De arriba abajo: de izquierda a derecha mide ~1850 px y en un teléfono
 * no se lee. */
export function textoMermaid(referencia: Estados): string {
  const nodos = referencia.estados.map((e) => `  ${e.clave}["${escapar(e.rotulo)}"]`)
  const flechas = referencia.transiciones
    .filter((t) => t.accion !== 'cancelar')
    .flatMap((t) => t.desde.map((desde) => `  ${desde} -->|"${escapar(t.rotulo)}"| ${t.hasta}`))
  return ['flowchart TD', ...nodos, ...flechas].join('\n')
}
