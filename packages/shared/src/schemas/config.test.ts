import { describe, expect, it } from 'vitest'
import {
  clinicPriceSchema,
  clinicSchema,
  createUserSchema,
  doctorSchema,
  labSettingsSchema,
  PRICING_UNITS,
  productCategorySchema,
  productSchema,
  stageSchema,
} from './config.ts'

describe('schemas de configuración', () => {
  it('labSettings exige nombre y acepta el resto opcional', () => {
    expect(labSettingsSchema.safeParse({ name: 'Arte Dental' }).success).toBe(true)
    const r = labSettingsSchema.safeParse({ name: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.message).toBe('El nombre es obligatorio')
  })

  it('clinic valida whatsapp en formato E.164 y días de crédito', () => {
    expect(
      clinicSchema.safeParse({
        name: 'Clínica Sonrisa',
        whatsapp: '+593991234567',
        paymentTermsDays: 30,
      }).success,
    ).toBe(true)
    const r = clinicSchema.safeParse({ name: 'X', whatsapp: '0991234567' })
    expect(r.success).toBe(false)
    if (!r.success)
      expect(r.error.issues[0]?.message).toBe(
        'El WhatsApp debe ir en formato internacional, ej. +593991234567',
      )
    expect(clinicSchema.safeParse({ name: 'X', paymentTermsDays: -1 }).success).toBe(false)
  })

  it('doctor exige clínica (uuid) y nombre', () => {
    expect(doctorSchema.safeParse({ clinicId: 'no-uuid', name: 'Dra. Paredes' }).success).toBe(
      false,
    )
    expect(
      doctorSchema.safeParse({
        clinicId: '5f9a7b6e-2c4d-4e8f-9a1b-3c5d7e9f1a2b',
        name: 'Dra. Paredes',
      }).success,
    ).toBe(true)
  })

  it('product valida unidad de precio, precio decimal y días', () => {
    expect(PRICING_UNITS).toEqual(['por_pieza', 'por_arcada', 'por_trabajo'])
    const ok = productSchema.safeParse({
      code: 'ZR',
      name: 'Zirconio',
      categoryId: '5f9a7b6e-2c4d-4e8f-9a1b-3c5d7e9f1a2b',
      pricingUnit: 'por_pieza',
      basePrice: '45.00',
      turnaroundDays: 5,
      requiresTryIn: true,
    })
    expect(ok.success).toBe(true)
    expect(
      productSchema.safeParse({
        code: 'ZR',
        name: 'Zirconio',
        categoryId: '5f9a7b6e-2c4d-4e8f-9a1b-3c5d7e9f1a2b',
        pricingUnit: 'por_pieza',
        basePrice: '45',
        turnaroundDays: 5,
      }).success,
    ).toBe(true)
    const bad = productSchema.safeParse({
      code: 'ZR',
      name: 'Zirconio',
      categoryId: '5f9a7b6e-2c4d-4e8f-9a1b-3c5d7e9f1a2b',
      pricingUnit: 'por_pieza',
      basePrice: '45.123',
      turnaroundDays: 5,
    })
    expect(bad.success).toBe(false)
    if (!bad.success)
      expect(bad.error.issues[0]?.message).toBe(
        'El precio debe ser un número con hasta 2 decimales',
      )
  })

  it('category y stage exigen nombre; stage valida color hex', () => {
    expect(productCategorySchema.safeParse({ name: 'Prótesis fija' }).success).toBe(true)
    expect(stageSchema.safeParse({ name: 'Modelo', color: '#0F766E' }).success).toBe(true)
    expect(stageSchema.safeParse({ name: 'Modelo', color: 'teal' }).success).toBe(false)
  })

  it('clinicPrice exige precio decimal', () => {
    expect(clinicPriceSchema.safeParse({ price: '40.50' }).success).toBe(true)
    expect(clinicPriceSchema.safeParse({ price: 'abc' }).success).toBe(false)
  })

  it('createUser exige correo, contraseña de 8+ y rol válido', () => {
    expect(
      createUserSchema.safeParse({
        name: 'Ana',
        email: 'ana@lab.local',
        password: 'Secreta123',
        role: 'recepcion',
      }).success,
    ).toBe(true)
    expect(
      createUserSchema.safeParse({
        name: 'Ana',
        email: 'ana@lab.local',
        password: '123',
        role: 'recepcion',
      }).success,
    ).toBe(false)
    expect(
      createUserSchema.safeParse({
        name: 'Ana',
        email: 'ana@lab.local',
        password: 'Secreta123',
        role: 'jefe',
      }).success,
    ).toBe(false)
  })
})
