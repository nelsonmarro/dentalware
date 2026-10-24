import Mermaid from '@theme/Mermaid'
import estados from '@site/src/referencia/estados.json'
import type { Estados as ReferenciaEstados } from '@site/src/referencia/estados'
import { textoMermaid } from '@site/src/referencia/texto-mermaid'
import { ROTULO_ROL } from './rol'

/** Derivado de la máquina de estados de shared por `pnpm referencia:estados` (enmienda del ADR 37:
 * el sitio no importa el runtime de shared); `referencia-estados.test.ts` falla si quedó viejo. */
const REFERENCIA = estados as ReferenciaEstados

const ROTULO_ESTADO = Object.fromEntries(REFERENCIA.estados.map((e) => [e.clave, e.rotulo]))

/** «Cancelar trabajo» no sale en el diagrama (`textoMermaid`): va en la nota y en la tabla. */
const CANCELAR = REFERENCIA.transiciones.find((t) => t.accion === 'cancelar')

const rotulos = (claves: readonly string[]) => claves.map((c) => ROTULO_ESTADO[c] ?? c)

/** «A, B y C». */
function enumerar(partes: readonly string[]): string {
  if (partes.length < 2) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`
}

const SIN_CANCELAR = REFERENCIA.estados
  .filter((e) => !CANCELAR?.desde.includes(e.clave))
  .map((e) => e.rotulo)

/** El diagrama va en una figura con `role="img"` (Mermaid pinta un SVG sin nombre); la nota y la
 * tabla quedan fuera, para que el lector de pantalla las lea. */
export function Estados() {
  return (
    <>
      {/* `tabIndex`: en el teléfono el diagrama no se encoge del todo y la figura se desplaza por
          dentro; así también se desplaza con el teclado. */}
      <figure
        className="estados"
        tabIndex={0}
        role="img"
        aria-label="Diagrama de los estados de un trabajo y las acciones que los cambian; la tabla de abajo tiene lo mismo"
      >
        <Mermaid value={textoMermaid(REFERENCIA)} />
      </figure>
      {CANCELAR && (
        <p className="estados__nota">
          <strong>{CANCELAR.rotulo}</strong> no sale en el diagrama: lleva a{' '}
          <strong>{ROTULO_ESTADO[CANCELAR.hasta]}</strong> desde cualquier estado salvo{' '}
          {enumerar(SIN_CANCELAR)}.
        </p>
      )}
      <div className="estados__tabla-envoltorio">
        <table className="estados__tabla">
          <caption>Acciones que cambian el estado de un trabajo</caption>
          <thead>
            <tr>
              <th scope="col">Acción</th>
              <th scope="col">De</th>
              <th scope="col">A</th>
              <th scope="col">Quién</th>
            </tr>
          </thead>
          <tbody>
            {REFERENCIA.transiciones.map((t) => (
              <tr key={t.accion}>
                <td>{t.rotulo}</td>
                <td>{rotulos(t.desde).join(', ')}</td>
                <td>{ROTULO_ESTADO[t.hasta]}</td>
                <td>
                  {t.roles.map((r, i) => (
                    <span key={r} className="estados__rol">
                      {ROTULO_ROL[r]}
                      {i < t.roles.length - 1 && ', '}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
