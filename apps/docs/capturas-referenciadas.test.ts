import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { leerDimensiones, leerDimensionesPng } from './capturas/dimensiones'
import { esProyecto, proyectosCaptura, rutaCaptura, type Proyecto } from './src/capturas-rutas'

const root = import.meta.dirname

function walk(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p, ext) : ext.test(f) ? [p] : []
  })
}

/** Nombres que declaran los specs: cada `captura(page, '<seccion>/<nombre>'`. */
function nombresEnSpecs(): Set<string> {
  const out = new Set<string>()
  for (const f of walk(join(root, 'capturas'), /\.spec\.ts$/)) {
    for (const m of readFileSync(f, 'utf8').matchAll(/captura\(\s*page,\s*'([^']+)'/g)) {
      out.add(m[1]!)
    }
  }
  return out
}

type CapturaEnGuia = { nombre: string; telefono: boolean; solo?: Proyecto }

// Un valor entre comillas o entre llaves (con un nivel de llaves dentro: `pie={<>…{x}…</>}`), que
// puede llevar `>` sin cerrar la etiqueta.
const VALOR = String.raw`"[^"]*"|\{(?:[^{}]|\{[^{}]*\})*\}`
const ETIQUETA = new RegExp(String.raw`<Captura\b((?:${VALOR}|[^>"{])*)/?>`, 'g')
const ATRIBUTO = new RegExp(String.raw`([A-Za-z]+)(?:=(${VALOR}))?`, 'g')

/** Cada `<Captura …>` de un MDX, con los atributos que eligen sus variantes. Los atributos se leen
 * uno a uno: un `>` o la palabra `telefono` dentro del valor de otro (`alt`, `pie`) no cuentan, y
 * `telefono={false}` es falso. */
function capturasEnTexto(texto: string): CapturaEnGuia[] {
  return [...texto.matchAll(ETIQUETA)].map(([, cuerpo = '']) => {
    const atributos = new Map(
      [...cuerpo.matchAll(ATRIBUTO)].map(([, nombre = '', valor]) => [nombre, valor] as const),
    )
    const cadena = (a: string) => /^"([^"]*)"$/.exec(atributos.get(a) ?? '')?.[1]
    const telefono =
      atributos.has('telefono') && atributos.get('telefono')?.replace(/\s+/g, '') !== '{false}'
    return {
      nombre: cadena('nombre') ?? '',
      telefono,
      solo: cadena('solo') as Proyecto | undefined,
    }
  })
}

function capturasEnDocs(): (CapturaEnGuia & { archivo: string })[] {
  return walk(join(root, 'docs'), /\.mdx?$/).flatMap((archivo) =>
    capturasEnTexto(readFileSync(archivo, 'utf8')).map((c) => ({ archivo, ...c })),
  )
}

const nombresEnDocs = () => new Set(capturasEnDocs().map((c) => c.nombre))

/** Cada PNG que pide una guía, como ruta bajo `static/` (`/img/capturas/<nombre>.<proyecto>.png`). */
const pngsPedidos = () =>
  new Set(
    capturasEnDocs().flatMap(({ nombre, telefono, solo }) =>
      proyectosCaptura({ telefono, solo }).map((p) => rutaCaptura(nombre, p)),
    ),
  )

describe('lectura de <Captura> en las guías', () => {
  it('lee nombre, telefono y solo', () => {
    expect(
      capturasEnTexto(
        '<Captura nombre="a/b" alt="x" telefono />\n<Captura nombre="c/d" alt="y" solo="telefono" />',
      ),
    ).toEqual([
      { nombre: 'a/b', telefono: true, solo: undefined },
      { nombre: 'c/d', telefono: false, solo: 'telefono' },
    ])
  })

  it('no confunde con `telefono` un alt que lo diga', () => {
    expect(capturasEnTexto('<Captura nombre="a/b" alt="Menú del telefono" />')).toEqual([
      { nombre: 'a/b', telefono: false, solo: undefined },
    ])
  })

  it('lee `telefono={false}` como falso y `telefono={true}` como verdadero', () => {
    expect(
      capturasEnTexto(
        '<Captura nombre="a/b" alt="x" telefono={false} /><Captura nombre="c/d" alt="y" telefono={true} />',
      ).map((c) => c.telefono),
    ).toEqual([false, true])
  })

  it('tolera `>` dentro de comillas o de llaves antes de `nombre`', () => {
    expect(
      capturasEnTexto(
        '<Captura alt="Ir a Inicio > Trabajos" pie={<>Toca <Boton>Volver</Boton></>} nombre="a/b" telefono />',
      ),
    ).toEqual([{ nombre: 'a/b', telefono: true, solo: undefined }])
  })

  it('lee una etiqueta partida en varias líneas', () => {
    expect(capturasEnTexto('<Captura\n  nombre="a/b"\n  alt="x"\n  solo="escritorio"\n/>')).toEqual(
      [{ nombre: 'a/b', telefono: false, solo: 'escritorio' }],
    )
  })
})

describe('capturas referenciadas', () => {
  it('el lector encuentra todas las `<Captura` de cada guía (ninguna se le escapa)', () => {
    const distintas = walk(join(root, 'docs'), /\.mdx?$/).flatMap((archivo) => {
      const texto = readFileSync(archivo, 'utf8')
      const etiquetas = texto.match(/<Captura\b/g)?.length ?? 0
      const leidas = capturasEnTexto(texto).length
      return etiquetas === leidas ? [] : [`${archivo}: ${etiquetas} etiquetas, ${leidas} leídas`]
    })
    expect(distintas).toEqual([])
  })

  it('existe el PNG de cada variante que pide una guía (escritorio; con `telefono`, las dos; con `solo`, esa)', () => {
    const faltan = capturasEnDocs().flatMap(({ archivo, nombre, telefono, solo }) =>
      proyectosCaptura({ telefono, solo })
        .map((p) => join(root, 'static', rutaCaptura(nombre, p)))
        .filter((png) => !existsSync(png))
        .map((png) => `${archivo}: ${png}`),
    )
    expect(faltan).toEqual([])
  })

  it('todo PNG de static/img/capturas lo pide alguna guía (ninguna variante huérfana)', () => {
    const pedidos = pngsPedidos()
    const huerfanos = walk(join(root, 'static', 'img', 'capturas'), /\.png$/)
      .map((png) => `/${relative(join(root, 'static'), png).split(sep).join('/')}`)
      .filter((ruta) => !pedidos.has(ruta))
    expect(huerfanos).toEqual([])
  })

  it('toda captura que usa una guía la produce un spec', () => {
    const specs = nombresEnSpecs()
    const faltan = [...nombresEnDocs()].filter((n) => !specs.has(n))
    expect(faltan).toEqual([])
  })
  it('toda captura que produce un spec la usa alguna guía (ninguna huérfana)', () => {
    const docs = nombresEnDocs()
    const huerfanas = [...nombresEnSpecs()].filter((n) => !docs.has(n))
    expect(huerfanas).toEqual([])
  })
  it('hay al menos una captura declarada', () => {
    expect(nombresEnSpecs().size).toBeGreaterThan(0)
  })
})

// UX8-04: `<Captura>` declara `width`/`height` desde `dimensiones.json`; si el JSON no cuadra con
// los PNG, la página salta al cargar (sin entrada) o la imagen se deforma (con una vieja).
describe('dimensiones de las capturas', () => {
  it('cada PNG referenciado tiene su entrada en `dimensiones.json` y coincide con su cabecera', () => {
    const dimensiones = leerDimensiones()
    const distintas = capturasEnDocs().flatMap(({ nombre, telefono, solo }) =>
      proyectosCaptura({ telefono, solo }).flatMap((p) => {
        const clave = `${nombre}.${p}`
        const png = join(root, 'static', rutaCaptura(nombre, p))
        if (!existsSync(png)) return [] // lo cuenta el test de PNG que faltan
        const { ancho, alto } = leerDimensionesPng(png)
        const registradas = dimensiones[clave]
        return registradas?.[0] === ancho && registradas[1] === alto
          ? []
          : [`${clave}: PNG ${ancho}×${alto}, JSON ${registradas?.join('×') ?? 'sin entrada'}`]
      }),
    )
    expect(distintas).toEqual([])
  })

  it('ninguna entrada de `dimensiones.json` sin su PNG', () => {
    const sinPng = Object.keys(leerDimensiones()).filter((clave) => {
      const punto = clave.lastIndexOf('.')
      const proyecto = clave.slice(punto + 1)
      return (
        !esProyecto(proyecto) ||
        !existsSync(join(root, 'static', rutaCaptura(clave.slice(0, punto), proyecto)))
      )
    })
    expect(sinPng).toEqual([])
  })
})

describe('reloj fijo de las capturas', () => {
  // El instante vive en tres sitios (seed, Playwright y el guion del modo rápido): si uno cambia
  // y los otros no, las fechas del seed y las del navegador dejan de coincidir.
  it('seed-demo-data.ts, playwright.config.ts y capturas-servidores.sh llevan el mismo instante', () => {
    const instante = /2026-10-20T10:30:00-05:00/
    for (const f of [
      join(root, '..', 'api', 'src', 'scripts', 'seed-demo-data.ts'),
      join(root, 'capturas', 'playwright.config.ts'),
      join(root, 'scripts', 'capturas-servidores.sh'),
    ]) {
      expect(readFileSync(f, 'utf8'), f).toMatch(instante)
    }
  })
})
