import type { AdjustmentInput } from '@dentalware/shared'
import { describe, expect, it } from 'vitest'
import { AccountForbiddenError, AccountInputError } from './errors.ts'
import { fakeAccounts, type FakeCase } from './fakes.ts'
import type { ClinicRef } from './ports.ts'
import { createAccountsService } from './service.ts'

// Reloj fijo: "hoy" es 2026-10-06 y "ahora", las 12:00 de Ecuador.
const NOW = new Date('2026-10-06T17:00:00Z')
const CLOCK = { today: () => '2026-10-06', now: () => NOW }
const at = (day: string) => new Date(`${day}T17:00:00Z`)

const SUR: ClinicRef = { id: 'cl-sur', name: 'Clínica Sur', active: true }
const NORTE: ClinicRef = { id: 'cl-norte', name: 'Clínica Norte', active: true }

const admin = { userId: 'u-admin', role: 'admin' } as const
const recepcion = { userId: 'u-recep', role: 'recepcion' } as const
const tecnico = { userId: 'u-tec', role: 'tecnico' } as const
const mensajero = { userId: 'u-men', role: 'mensajero' } as const
const USERS = { 'u-admin': 'Admin', 'u-recep': 'Recepción' }

function makeCase(over: Partial<FakeCase> & Pick<FakeCase, 'id'>): FakeCase {
  return {
    clinicId: SUR.id,
    code: `26-${over.id}`,
    patientRef: 'Paciente',
    status: 'entregado',
    deliveredAt: at('2026-09-01'),
    totalCents: 10_000,
    remakeChargePct: null,
    ...over,
  }
}

/** Sur: `a` (100.00) entregado sin pagar, `c` (20.00) cobrado con un pago que lo cubre y `p`
 * en proceso; Norte: `n`. */
const CASES = [
  makeCase({ id: 'a', totalCents: 10_000 }),
  makeCase({ id: 'c', totalCents: 2_000, status: 'cobrado' }),
  makeCase({ id: 'p', totalCents: 3_000, status: 'en_proceso' }),
  makeCase({ id: 'n', clinicId: NORTE.id, totalCents: 4_000 }),
]

function build(seed: Parameters<typeof fakeAccounts>[0] = {}) {
  const fake = fakeAccounts({
    clinics: [SUR, NORTE],
    cases: CASES,
    users: USERS,
    payments: [
      {
        id: 'pc',
        clinicId: SUR.id,
        amountCents: 2_000,
        method: 'efectivo',
        paidOn: '2026-10-02',
        reference: null,
        notes: null,
        createdAt: at('2026-10-02'),
        createdByName: 'Recepción',
        voided: null,
      },
    ],
    allocations: [{ paymentId: 'pc', caseId: 'c', amountCents: 2_000 }],
    ...seed,
  })
  const service = createAccountsService({ accounts: fake.repo, uow: fake.uow, clock: CLOCK })
  return { ...fake, service }
}

const ajuste = (over: Partial<AdjustmentInput> = {}): AdjustmentInput => ({
  clinicaId: SUR.id,
  trabajoId: null,
  monto: '150.00',
  motivo: 'Saldo inicial',
  fecha: '2026-06-30',
  ...over,
})

const statusOf = (fake: ReturnType<typeof build>, id: string) =>
  fake.cases.find((c) => c.id === id)?.status

describe('features/accounts/service: ajustes (CTA-3)', () => {
  it('un ajuste sin trabajo («Saldo inicial») suma al saldo y entra en la antigüedad por su fecha', async () => {
    const fake = build()
    const before = await fake.service.clinicAccount(SUR.id)
    expect(before.balance).toBe('100.00')

    const view = await fake.service.registerAdjustment(ajuste(), admin)
    expect(view).toEqual({
      id: 'ajuste-1',
      clinicId: SUR.id,
      case: null,
      amount: '150.00',
      reason: 'Saldo inicial',
      date: '2026-06-30',
      createdAt: expect.any(Date),
      by: 'Admin',
    })
    const account = await fake.service.clinicAccount(SUR.id)
    expect(account.balance).toBe('250.00')
    // 2026-06-30 → 98 días; `a` se entregó el 2026-09-01 → 35 días.
    expect(account.aging).toEqual({
      '0_30': '0.00',
      '31_60': '100.00',
      '61_90': '0.00',
      '90_mas': '150.00',
    })
    expect(account.oldestDays).toBe(98)
    // Sin trabajo, no hay a quién escribirle un evento ni nada que reevaluar.
    expect(fake.events).toEqual([])
    expect(fake.locked).toEqual([])
  })

  it('un ajuste sin trabajo negativo resta del saldo y descuenta de la partida más antigua', async () => {
    const fake = build()
    await fake.service.registerAdjustment(
      ajuste({ monto: '-30.00', motivo: 'Nota de crédito' }),
      admin,
    )
    const account = await fake.service.clinicAccount(SUR.id)
    expect(account.balance).toBe('70.00')
    expect(account.aging['31_60']).toBe('70.00')
  })

  it('el movimiento lleva el monto con signo, el motivo y quién lo registró', async () => {
    const fake = build()
    await fake.service.registerAdjustment(
      ajuste({
        trabajoId: 'a',
        monto: '-10.00',
        motivo: 'Descuento por demora',
        fecha: '2026-10-05',
      }),
      admin,
    )
    const { movements } = await fake.service.clinicAccount(SUR.id)
    expect(movements.find((m) => m.kind === 'ajuste')).toEqual({
      id: 'ajuste-1',
      kind: 'ajuste',
      date: '2026-10-05',
      amount: '-10.00',
      case: { id: 'a', code: '26-a' },
      by: 'Admin',
      reason: 'Descuento por demora',
      reference: null,
      method: null,
      voided: null,
    })
  })

  it('con trabajo: escribe adjustment_added con el monto con signo y el motivo, y cambia su neto', async () => {
    const fake = build()
    await fake.service.registerAdjustment(
      ajuste({ trabajoId: 'a', monto: '-25.50', motivo: 'Descuento acordado' }),
      admin,
    )
    expect(fake.events).toEqual([
      {
        caseId: 'a',
        type: 'adjustment_added',
        fromValue: null,
        toValue: '-25.50',
        reason: 'Descuento acordado',
        actorId: 'u-admin',
      },
    ])
    expect(statusOf(fake, 'a')).toBe('entregado')
    const account = await fake.service.clinicAccount(SUR.id)
    expect(account.openCases).toEqual([
      expect.objectContaining({ id: 'a', adjustments: '-25.50', outstanding: '74.50' }),
    ])
    expect(fake.locked).toEqual([['a']])
  })

  it('un descuento que cubre lo pendiente cierra el trabajo (cobrado con paid_at)', async () => {
    const fake = build({
      payments: [
        {
          id: 'p1',
          clinicId: SUR.id,
          amountCents: 9_000,
          method: 'efectivo',
          paidOn: '2026-10-02',
          reference: null,
          notes: null,
          createdAt: at('2026-10-02'),
          createdByName: 'Recepción',
          voided: null,
        },
      ],
      allocations: [{ paymentId: 'p1', caseId: 'a', amountCents: 9_000 }],
    })
    await fake.service.registerAdjustment(
      ajuste({ trabajoId: 'a', monto: '-10.00', motivo: 'Descuento por pronto pago' }),
      admin,
    )
    expect(statusOf(fake, 'a')).toBe('cobrado')
    expect(fake.paidAt.get('a')).toEqual(NOW)
    expect(fake.events.map((e) => [e.type, e.fromValue, e.toValue])).toEqual([
      ['adjustment_added', null, '-10.00'],
      ['status_changed', 'entregado', 'cobrado'],
    ])
  })

  it('un recargo sobre un trabajo cobrado lo reabre (vuelve a entregado sin paid_at)', async () => {
    const fake = build()
    await fake.service.registerAdjustment(
      ajuste({ trabajoId: 'c', monto: '5.00', motivo: 'Recargo por urgencia' }),
      admin,
    )
    expect(statusOf(fake, 'c')).toBe('entregado')
    expect(fake.paidAt.get('c')).toBeNull()
    expect(fake.events.map((e) => [e.type, e.fromValue, e.toValue])).toEqual([
      ['adjustment_added', null, '5.00'],
      ['status_changed', 'cobrado', 'entregado'],
    ])
    const account = await fake.service.clinicAccount(SUR.id)
    expect(account.openCases).toEqual([
      expect.objectContaining({ id: 'a' }),
      expect.objectContaining({ id: 'c', outstanding: '5.00' }),
    ])
  })

  it('un descuento sobre un trabajo cobrado lo deja cobrado', async () => {
    const fake = build()
    await fake.service.registerAdjustment(
      ajuste({ trabajoId: 'c', monto: '-5.00', motivo: 'Descuento' }),
      admin,
    )
    expect(statusOf(fake, 'c')).toBe('cobrado')
    expect(fake.events.map((e) => e.type)).toEqual(['adjustment_added'])
  })

  describe('validaciones: 422 con su campo y sin escribir nada', () => {
    it.each([
      [
        'un trabajo de otra clínica',
        { trabajoId: 'n' },
        'trabajoId',
        'El trabajo es de otra clínica',
      ],
      ['un trabajo sin entregar', { trabajoId: 'p' }, 'trabajoId', 'El trabajo no está entregado'],
      ['un trabajo que no existe', { trabajoId: 'nada' }, 'trabajoId', 'El trabajo no existe'],
      ['una clínica que no existe', { clinicaId: 'cl-nada' }, 'clinicaId', 'La clínica no existe'],
    ] as const)('%s', async (_label, over, path, message) => {
      const fake = build()
      const error = await fake.service
        .registerAdjustment(ajuste({ ...over, monto: '-5.00' }), admin)
        .catch((e: unknown) => e)
      expect(error).toBeInstanceOf(AccountInputError)
      expect(error).toMatchObject({ path, message })
      expect(await fake.repo.adjustments()).toEqual([])
      expect(fake.events).toEqual([])
    })
  })

  it.each([
    ['recepción', recepcion],
    ['técnico', tecnico],
    ['mensajero', mensajero],
  ])('solo el administrador registra ajustes: %s no puede', async (_label, ctx) => {
    const fake = build()
    await expect(fake.service.registerAdjustment(ajuste(), ctx)).rejects.toBeInstanceOf(
      AccountForbiddenError,
    )
    expect(await fake.repo.adjustments()).toEqual([])
  })
})
