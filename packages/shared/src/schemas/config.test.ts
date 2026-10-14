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
    const r = clinicSchema.safeParse({ name: 'X', whatsapp: '12345' })
    expect(r.success).toBe(false)
    if (!r.success)
      expect(r.error.issues[0]?.message).toBe(
        'Escribe el WhatsApp como 099 123 4567 o +593 99 123 4567',
      )
    expect(clinicSchema.safeParse({ name: 'X', paymentTermsDays: -1 }).success).toBe(false)
  })

  it('clinic normaliza el WhatsApp escrito como se habla (UX7-06)', () => {
    const r = clinicSchema.safeParse({ name: 'X', whatsapp: '099 123 4567' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.whatsapp).toBe('+593991234567')
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

  it('los campos de texto opcionales normalizan vacío/espacios a null, no a undefined', () => {
    const r = clinicSchema.safeParse({
      name: 'Clínica Sonrisa',
      ruc: '',
      address: '   ',
      city: '',
      phone: '',
      whatsapp: '',
      email: '',
      notes: '',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.ruc).toBeNull()
      expect(r.data.address).toBeNull()
      expect(r.data.city).toBeNull()
      expect(r.data.phone).toBeNull()
      expect(r.data.whatsapp).toBeNull()
      expect(r.data.email).toBeNull()
      expect(r.data.notes).toBeNull()
    }
    // null explícito (lo que llega al re-validar en el servidor un valor ya limpiado) también es válido
    const r2 = clinicSchema.safeParse({
      name: 'X',
      ruc: null,
      whatsapp: null,
      email: null,
    })
    expect(r2.success).toBe(true)
    if (r2.success) {
      expect(r2.data.ruc).toBeNull()
      expect(r2.data.whatsapp).toBeNull()
      expect(r2.data.email).toBeNull()
    }
    // un valor válido pasa sin cambios
    const r3 = clinicSchema.safeParse({
      name: 'X',
      whatsapp: '+593991234567',
      email: 'Clinica@Sonrisa.COM',
    })
    expect(r3.success).toBe(true)
    if (r3.success) {
      expect(r3.data.whatsapp).toBe('+593991234567')
      expect(r3.data.email).toBe('clinica@sonrisa.com')
    }
  })

  it('clinic quita el 0 tras el +593 del WhatsApp (+593 099 123 4567)', () => {
    const r = clinicSchema.safeParse({ name: 'X', whatsapp: '+593 099 123 4567' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.whatsapp).toBe('+593991234567')
  })

  it.each(['', '  ', null, undefined])('clinic da null con whatsapp %j', (whatsapp) => {
    const r = clinicSchema.safeParse({ name: 'X', whatsapp })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.whatsapp).toBeNull()
  })

  it('clinic rechaza un WhatsApp de solo separadores', () => {
    const r = clinicSchema.safeParse({ name: 'X', whatsapp: '---' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe(
        'Escribe el WhatsApp como 099 123 4567 o +593 99 123 4567',
      )
    }
  })

  it('labSettings normaliza codePrefix vacío a null (sin la rama muerta anterior)', () => {
    const r = labSettingsSchema.safeParse({ name: 'Arte Dental', codePrefix: '' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.codePrefix).toBeNull()
  })

  it('createUser exige correo, contraseña de 8+ y rol válido', () => {
    // No son contraseñas reales, solo datos de prueba para el esquema; `repeat` evita que
    // parezcan una contraseña literal (GitGuardian marca "Generic Password" en ese patrón).
    const validPassword = 'x'.repeat(10)
    const shortPassword = 'x'.repeat(3)
    expect(
      createUserSchema.safeParse({
        name: 'Ana',
        email: 'ana@lab.local',
        password: validPassword,
        role: 'recepcion',
      }).success,
    ).toBe(true)
    expect(
      createUserSchema.safeParse({
        name: 'Ana',
        email: 'ana@lab.local',
        password: shortPassword,
        role: 'recepcion',
      }).success,
    ).toBe(false)
    expect(
      createUserSchema.safeParse({
        name: 'Ana',
        email: 'ana@lab.local',
        password: validPassword,
        role: 'jefe',
      }).success,
    ).toBe(false)
  })
})
