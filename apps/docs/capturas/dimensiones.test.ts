import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  leerDimensiones,
  leerDimensionesPng,
  regenerarDimensiones,
  registrarDimensiones,
} from './dimensiones'

let dir: string
let png: string
let json: string

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'dimensiones-'))
  png = join(dir, 'b.telefono.png')
  json = join(dir, 'dimensiones.json')
  const datos = await sharp({ create: { width: 3, height: 2, channels: 3, background: '#fff' } })
    .png()
    .toBuffer()
  writeFileSync(png, datos)
})

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('leerDimensionesPng', () => {
  it('lee ancho y alto de la cabecera del PNG', () => {
    expect(leerDimensionesPng(png)).toEqual({ ancho: 3, alto: 2 })
  })

  it('con un archivo que no es PNG, lanza', () => {
    const texto = join(dir, 'texto.png')
    writeFileSync(texto, 'esto no es una imagen, aunque lo diga su extensión')
    expect(() => leerDimensionesPng(texto)).toThrow(/no es un PNG/)
  })

  it('con la firma de PNG pero otro primer chunk que IHDR, lanza', () => {
    const datos = Buffer.from(readFileSync(png))
    datos.write('IDAT', 12, 'ascii')
    const otro = join(dir, 'otro-chunk.png')
    writeFileSync(otro, datos)
    expect(() => leerDimensionesPng(otro)).toThrow(/no es un PNG/)
  })
})

describe('leerDimensiones', () => {
  it('sin JSON, devuelve un objeto vacío', () => {
    expect(leerDimensiones(json)).toEqual({})
  })

  it('lee las entradas `[ancho, alto]`', () => {
    writeFileSync(json, '{ "a/b.telefono": [10, 20] }\n')
    expect(leerDimensiones(json)).toEqual({ 'a/b.telefono': [10, 20] })
  })

  it.each([
    ['una lista en vez de un objeto', '[1, 2]'],
    ['un valor que no es objeto', '5'],
    ['una entrada que no es un par', '{ "a/b.telefono": [10] }'],
    ['una entrada con texto', '{ "a/b.telefono": [10, "20"] }'],
    ['una entrada que no es lista', '{ "a/b.telefono": 10 }'],
  ])('con %s, lanza «dimensiones.json inválido»', (_caso, contenido) => {
    writeFileSync(json, `${contenido}\n`)
    expect(() => leerDimensiones(json)).toThrow(/dimensiones\.json inválido/)
  })

  it('con un JSON corrupto (no parsea), lanza «dimensiones.json inválido»', () => {
    writeFileSync(json, '{ "a/b.telefono": [10, 20')
    expect(() => leerDimensiones(json)).toThrow(/dimensiones\.json inválido/)
  })
})

describe('registrarDimensiones', () => {
  it('sin JSON previo, lo crea con la entrada `<nombre>.<proyecto>` en píxeles del PNG', () => {
    registrarDimensiones('a/b', 'telefono', png, json)
    expect(JSON.parse(readFileSync(json, 'utf8'))).toEqual({ 'a/b.telefono': [3, 2] })
  })

  it('lo escribe como Prettier (una entrada por línea y salto final): `format:check` no lo toca', () => {
    registrarDimensiones('a/b', 'telefono', png, json)
    registrarDimensiones('c/d', 'escritorio', png, json)
    expect(readFileSync(json, 'utf8')).toBe(
      '{\n  "a/b.telefono": [3, 2],\n  "c/d.escritorio": [3, 2]\n}\n',
    )
  })

  it('conserva las entradas que ya había y escribe las claves ordenadas', () => {
    registrarDimensiones('z/ultima', 'escritorio', png, json)
    registrarDimensiones('a/primera', 'telefono', png, json)
    expect(Object.keys(JSON.parse(readFileSync(json, 'utf8')))).toEqual([
      'a/primera.telefono',
      'z/ultima.escritorio',
    ])
  })

  it('una captura repetida reemplaza su entrada', () => {
    writeFileSync(json, '{ "a/b.telefono": [10, 20] }\n')
    registrarDimensiones('a/b', 'telefono', png, json)
    expect(JSON.parse(readFileSync(json, 'utf8'))).toEqual({ 'a/b.telefono': [3, 2] })
  })
})

describe('regenerarDimensiones', () => {
  it('registra cada PNG de la carpeta por `<seccion>/<nombre>.<proyecto>` y borra las entradas sin PNG', () => {
    const capturas = join(dir, 'capturas')
    mkdirSync(join(capturas, 'recepcion'), { recursive: true })
    copyFileSync(png, join(capturas, 'recepcion', 'inicio.escritorio.png'))
    copyFileSync(png, join(capturas, 'recepcion', 'inicio.telefono.png'))
    writeFileSync(json, '{ "vieja/borrada.escritorio": [10, 20] }\n')
    regenerarDimensiones(capturas, json)
    expect(JSON.parse(readFileSync(json, 'utf8'))).toEqual({
      'recepcion/inicio.escritorio': [3, 2],
      'recepcion/inicio.telefono': [3, 2],
    })
  })

  it('un PNG con un proyecto desconocido para la regeneración', () => {
    const capturas = join(dir, 'capturas')
    mkdirSync(join(capturas, 'recepcion'), { recursive: true })
    copyFileSync(png, join(capturas, 'recepcion', 'inicio.tablet.png'))
    expect(() => regenerarDimensiones(capturas, json)).toThrow(/proyecto desconocido/)
  })
})
