import { afterEach, describe, expect, it, vi } from 'vitest'
import { readStored, writeStored } from './storage'

describe('storage del DataGrid', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('devuelve el valor guardado bajo la clave con versión', () => {
    writeStored('datagrid:productos:sizing', { code: 120 })
    expect(readStored('datagrid:productos:sizing', {})).toEqual({ code: 120 })
    expect(localStorage.getItem('datagrid:productos:sizing:v1')).toBe('{"code":120}')
  })

  it('devuelve el valor por defecto si no hay nada o el JSON está roto', () => {
    expect(readStored('datagrid:x:sizing', { a: 1 })).toEqual({ a: 1 })
    localStorage.setItem('datagrid:x:sizing:v1', '{rota')
    expect(readStored('datagrid:x:sizing', { a: 1 })).toEqual({ a: 1 })
  })

  it('no lanza si localStorage falla', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(() => writeStored('datagrid:x:sizing', { a: 1 })).not.toThrow()
    expect(readStored('datagrid:x:sizing', 'fallback')).toBe('fallback')
  })
})
