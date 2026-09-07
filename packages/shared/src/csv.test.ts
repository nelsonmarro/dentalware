import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from './csv.ts'

describe('parseCsv', () => {
  it('separa columnas simples por coma y filas por salto de línea', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('respeta comas dentro de campos entre comillas', () => {
    expect(parseCsv('a,b\n"Clínica, Sonrisa","Dr. Pérez"')).toEqual([
      ['a', 'b'],
      ['Clínica, Sonrisa', 'Dr. Pérez'],
    ])
  })

  it('desescapa comillas dobles dentro de un campo entre comillas', () => {
    expect(parseCsv('nota\n"Dijo ""hola"" a todos"')).toEqual([['nota'], ['Dijo "hola" a todos']])
  })

  it('respeta saltos de línea dentro de campos entre comillas', () => {
    expect(parseCsv('nota\n"línea 1\nlínea 2"')).toEqual([['nota'], ['línea 1\nlínea 2']])
  })

  it('acepta saltos de línea \\r\\n', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('quita el BOM inicial', () => {
    expect(parseCsv('﻿a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('ignora líneas vacías (incluida una línea vacía final)', () => {
    expect(parseCsv('a,b\n1,2\n\n3,4\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ])
  })
})

describe('toCsv', () => {
  it('une columnas con coma y filas con \\r\\n', () => {
    expect(
      toCsv([
        ['a', 'b'],
        ['1', '2'],
      ]),
    ).toBe('a,b\r\n1,2')
  })

  it('cita valores que contienen coma, comilla o salto de línea', () => {
    expect(toCsv([['Clínica, Sonrisa', 'Dijo "hola"', 'línea 1\nlínea 2', 'simple']])).toBe(
      '"Clínica, Sonrisa","Dijo ""hola""","línea 1\nlínea 2",simple',
    )
  })
})
