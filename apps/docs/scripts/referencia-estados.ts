import { realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { format, resolveConfig } from 'prettier'
import {
  CASE_ACTION_LABEL,
  CASE_ACTIONS,
  CASE_STATUS_LABEL,
  CASE_STATUSES,
  CASE_TRANSITIONS,
} from '@dentalware/shared'
import type { Estados } from '../src/referencia/estados'

/** La referencia de estados del manual (`<Estados />`) sale de este JSON, que se deriva de la
 * máquina de estados de shared: un estado o una transición nuevos hacen fallar
 * `referencia-estados.test.ts` hasta regenerarlo con `pnpm --filter @dentalware/docs
 * referencia:estados` (enmienda del ADR 37: el sitio solo importa tipos de shared, así que el
 * runtime de shared se lee aquí y no en el componente). `__dirname` y no `import.meta`: el paquete
 * es CommonJS para `tsx` (como `capturas/dimensiones.ts`). */
export const ESTADOS_JSON = join(__dirname, '..', 'src', 'referencia', 'estados.json')

/** Pura, sin I/O: estados y acciones en el orden de `CASE_STATUSES` y `CASE_ACTIONS`. */
export function derivarEstados(): Estados {
  return {
    estados: CASE_STATUSES.map((clave) => ({ clave, rotulo: CASE_STATUS_LABEL[clave] })),
    transiciones: CASE_ACTIONS.map((accion) => {
      const { from, to, roles } = CASE_TRANSITIONS[accion]
      return {
        accion,
        rotulo: CASE_ACTION_LABEL[accion],
        desde: [...from],
        hasta: to,
        roles: [...roles],
      }
    }),
  }
}

/** Pasado por Prettier con la configuración del repo, para que `pnpm format:check` no lo toque (a
 * mano, `JSON.stringify` abre cada lista corta en varias líneas y Prettier las junta). */
export async function escribirEstados(ruta = ESTADOS_JSON): Promise<void> {
  const opciones = await resolveConfig(ruta)
  const texto = await format(JSON.stringify(derivarEstados()), { ...opciones, filepath: ruta })
  writeFileSync(ruta, texto)
}

/** Solo al correrlo con `tsx` (como `isMainModule` de la API): el test lo importa sin escribir. */
function esPrincipal(): boolean {
  if (!process.argv[1]) return false
  try {
    return realpathSync(__filename) === realpathSync(process.argv[1])
  } catch {
    return false
  }
}

if (esPrincipal()) {
  void escribirEstados().then(() => console.log(`Escrito ${ESTADOS_JSON}`))
}
