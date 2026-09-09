import { describe, expect, it } from 'vitest'
import type { ImportError } from './import.ts'
import { importRowSchema, sortImportErrors } from './import.ts'

function row(overrides: Record<string, string> = {}) {
  return {
    clinica: 'Clínica Sonrisa',
    doctor: 'Dr. Pérez',
    paciente: 'Ana Paciente',
    producto: 'ZR',
    piezas: '11,12',
    cantidad: '2',
    color: 'A2',
    fecha_deseada: '2026-09-20',
    caja: 'C-001',
    observaciones: 'Urgente',
    ...overrides,
  }
}

describe('importRowSchema', () => {
  it('valida y mapea una fila completa', () => {
    const result = importRowSchema.parse(row())
    expect(result).toEqual({
      clinica: 'Clínica Sonrisa',
      doctor: 'Dr. Pérez',
      paciente: 'Ana Paciente',
      producto: 'ZR',
      piezas: [11, 12],
      cantidad: 2,
      color: 'A2',
      fecha_deseada: '2026-09-20',
      caja: 'C-001',
      observaciones: 'Urgente',
    })
  })

  it('permite piezas vacías y usa cantidad por defecto 1', () => {
    const result = importRowSchema.parse(row({ piezas: '', cantidad: '' }))
    expect(result.piezas).toEqual([])
    expect(result.cantidad).toBe(1)
  })

  it('rechaza una pieza FDI inválida con el mensaje correspondiente', () => {
    const result = importRowSchema.safeParse(row({ piezas: '99' }))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Pieza dental FDI inválida')
  })

  it('convierte una fecha DD/MM/AAAA a ISO', () => {
    const result = importRowSchema.parse(row({ fecha_deseada: '15/09/2026' }))
    expect(result.fecha_deseada).toBe('2026-09-15')
  })

  it('deja fecha_deseada, color, caja y observaciones opcionales en null si vienen vacíos', () => {
    const result = importRowSchema.parse(
      row({ fecha_deseada: '', color: '', caja: '', observaciones: '' }),
    )
    expect(result.fecha_deseada).toBeNull()
    expect(result.color).toBeNull()
    expect(result.caja).toBeNull()
    expect(result.observaciones).toBeNull()
  })

  it('exige clínica, doctor, paciente y producto no vacíos, con mensajes naturales', () => {
    expect(importRowSchema.safeParse(row({ clinica: '' })).error?.issues[0]?.message).toBe(
      'La clínica es obligatoria',
    )
    expect(importRowSchema.safeParse(row({ doctor: '' })).error?.issues[0]?.message).toBe(
      'El doctor es obligatorio',
    )
    expect(importRowSchema.safeParse(row({ paciente: '' })).error?.issues[0]?.message).toBe(
      'La referencia del paciente es obligatoria',
    )
    expect(importRowSchema.safeParse(row({ producto: '' })).error?.issues[0]?.message).toBe(
      'El producto es obligatorio',
    )
  })

  it('rechaza cantidad mayor a 99', () => {
    const result = importRowSchema.safeParse(row({ cantidad: '100' }))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({
      path: ['cantidad'],
      message: 'La cantidad máxima es 99',
    })
  })

  it('rechaza un paciente de más de 120 caracteres', () => {
    const result = importRowSchema.safeParse(row({ paciente: 'A'.repeat(130) }))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({
      path: ['paciente'],
      message: 'Máximo 120 caracteres',
    })
  })

  it.each([
    ['31/02/2026', 'día inexistente en formato DD/MM/AAAA'],
    ['2026-13-40', 'mes y día inexistentes en formato ISO'],
    ['29/02/2025', '2025 no es bisiesto'],
  ])('rechaza %s (%s)', (fecha) => {
    const result = importRowSchema.safeParse(row({ fecha_deseada: fecha }))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Fecha inválida (usa AAAA-MM-DD o DD/MM/AAAA)')
  })

  it('acepta el 29 de febrero de un año bisiesto (2028)', () => {
    const result = importRowSchema.parse(row({ fecha_deseada: '29/02/2028' }))
    expect(result.fecha_deseada).toBe('2028-02-29')
  })
})

describe('sortImportErrors', () => {
  it('ordena por fila y, dentro de la misma fila, por el orden de IMPORT_COLUMNS', () => {
    const errors: ImportError[] = [
      { row: 3, column: 'fecha_deseada', message: 'Fecha inválida' },
      { row: 2, column: 'producto', message: 'El producto "X" no existe' },
      { row: 2, column: 'clinica', message: 'La clínica "Y" no existe' },
    ]

    expect(sortImportErrors(errors)).toEqual([
      { row: 2, column: 'clinica', message: 'La clínica "Y" no existe' },
      { row: 2, column: 'producto', message: 'El producto "X" no existe' },
      { row: 3, column: 'fecha_deseada', message: 'Fecha inválida' },
    ])
  })

  it('manda las columnas que no son de IMPORT_COLUMNS al final de la fila', () => {
    const errors: ImportError[] = [
      { row: 1, column: 'dueDate', message: 'Fecha inválida' },
      { row: 1, column: 'clinica', message: 'La clínica es obligatoria' },
    ]

    expect(sortImportErrors(errors)).toEqual([
      { row: 1, column: 'clinica', message: 'La clínica es obligatoria' },
      { row: 1, column: 'dueDate', message: 'Fecha inválida' },
    ])
  })
})
