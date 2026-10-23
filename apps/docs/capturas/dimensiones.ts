import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { esProyecto, type Proyecto } from '../src/capturas-rutas'

/** Tamaño en píxeles de cada captura (`"<nombre>.<proyecto>": [ancho, alto]`): lo escribe la
 * tubería al guardar cada PNG y `<Captura>` lo pinta como `width`/`height` (a la mitad: son 2x),
 * para que la página no salte al cargarlas. Node puro, sin Playwright ni Docusaurus: lo importan
 * `helpers.ts`, `scripts/dimensiones.ts` y los tests. `__dirname` y no `import.meta.dirname`: en
 * Playwright este archivo carga como CommonJS (ver `helpers.ts`). */
export const CAPTURAS_DIR = join(__dirname, '..', 'static', 'img', 'capturas')
export const DIMENSIONES_JSON = join(CAPTURAS_DIR, 'dimensiones.json')

export type Dimensiones = Record<string, [number, number]>

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Ancho y alto de la cabecera IHDR (el primer chunk de todo PNG): bytes 16–19 y 20–23. */
export function leerDimensionesPng(ruta: string): { ancho: number; alto: number } {
  const datos = readFileSync(ruta)
  if (datos.length < 24 || !datos.subarray(0, 8).equals(FIRMA_PNG)) {
    throw new Error(`${ruta} no es un PNG.`)
  }
  return { ancho: datos.readUInt32BE(16), alto: datos.readUInt32BE(20) }
}

export function leerDimensiones(archivoJson = DIMENSIONES_JSON): Dimensiones {
  return existsSync(archivoJson)
    ? (JSON.parse(readFileSync(archivoJson, 'utf8')) as Dimensiones)
    : {}
}

/** Con las claves ordenadas y una entrada por línea, como lo dejaría Prettier: `format:check` no
 * lo toca y un `git diff` solo muestra las capturas que cambiaron de tamaño. */
export function escribirDimensiones(dimensiones: Dimensiones, archivoJson = DIMENSIONES_JSON) {
  const lineas = Object.keys(dimensiones)
    .sort()
    .map((clave) => {
      const [ancho, alto] = dimensiones[clave] ?? []
      return `  ${JSON.stringify(clave)}: [${ancho}, ${alto}]`
    })
  writeFileSync(archivoJson, lineas.length ? `{\n${lineas.join(',\n')}\n}\n` : '{}\n')
}

/** Registra (o reemplaza) el tamaño del PNG de `<nombre>.<proyecto>` en el JSON. */
export function registrarDimensiones(
  nombre: string,
  proyecto: Proyecto,
  png: string,
  archivoJson = DIMENSIONES_JSON,
): void {
  const { ancho, alto } = leerDimensionesPng(png)
  const dimensiones = leerDimensiones(archivoJson)
  dimensiones[`${nombre}.${proyecto}`] = [ancho, alto]
  escribirDimensiones(dimensiones, archivoJson)
}

function pngsBajo(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? pngsBajo(p) : f.endsWith('.png') ? [p] : []
  })
}

/** Rehace el JSON entero desde los PNG de `dirCapturas` (`<seccion>/<nombre>.<proyecto>.png`): lo
 * que no tiene PNG desaparece. Lo corre `pnpm capturas:dimensiones`. */
export function regenerarDimensiones(dirCapturas = CAPTURAS_DIR, archivoJson = DIMENSIONES_JSON) {
  const dimensiones: Dimensiones = {}
  for (const png of pngsBajo(dirCapturas)) {
    const clave = relative(dirCapturas, png)
      .split(sep)
      .join('/')
      .replace(/\.png$/, '')
    const proyecto = clave.slice(clave.lastIndexOf('.') + 1)
    if (!esProyecto(proyecto)) throw new Error(`${png}: proyecto desconocido «${proyecto}».`)
    const { ancho, alto } = leerDimensionesPng(png)
    dimensiones[clave] = [ancho, alto]
  }
  escribirDimensiones(dimensiones, archivoJson)
}
