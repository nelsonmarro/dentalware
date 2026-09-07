import { describe, expect, it } from 'vitest'
import { importRowSchema } from './import.ts'

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

  it('exige clínica, doctor, paciente y producto no vacíos', () => {
    expect(importRowSchema.safeParse(row({ clinica: '' })).success).toBe(false)
    expect(importRowSchema.safeParse(row({ doctor: '' })).success).toBe(false)
    expect(importRowSchema.safeParse(row({ paciente: '' })).success).toBe(false)
    expect(importRowSchema.safeParse(row({ producto: '' })).success).toBe(false)
  })
})
