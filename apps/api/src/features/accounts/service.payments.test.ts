import type { PaymentInput } from '@dentalware/shared'
import { describe, expect, it } from 'vitest'
import {
  AccountForbiddenError,
  AccountInputError,
  PaymentNotFoundError,
  PaymentVoidedError,
} from './errors.ts'
import { fakeAccounts, type FakeCase, type FakePayment } from './fakes.ts'
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

function makePayment(
  over: Partial<FakePayment> & Pick<FakePayment, 'id' | 'amountCents'>,
): FakePayment {
  return {
    clinicId: SUR.id,
    method: 'efectivo',
    paidOn: '2026-10-02',
    reference: null,
    notes: null,
    createdAt: at('2026-10-02'),
    createdByName: 'Recepción',
    voided: null,
    ...over,
  }
}

/** Sur: `a` (100.00) y `b` (50.00) entregados, `c` ya cobrado y `p` en proceso; Norte: `n`. */
const CASES = [
  makeCase({ id: 'a', totalCents: 10_000, deliveredAt: at('2026-09-01') }),
  makeCase({ id: 'b', totalCents: 5_000, deliveredAt: at('2026-09-10') }),
  makeCase({ id: 'c', totalCents: 2_000, status: 'cobrado' }),
  makeCase({ id: 'p', totalCents: 3_000, status: 'en_proceso' }),
  makeCase({ id: 'n', clinicId: NORTE.id, totalCents: 4_000 }),
]

function build(seed: Parameters<typeof fakeAccounts>[0] = {}) {
  const fake = fakeAccounts({ clinics: [SUR, NORTE], cases: CASES, users: USERS, ...seed })
  const service = createAccountsService({ accounts: fake.repo, uow: fake.uow, clock: CLOCK })
  return { ...fake, service }
}

const pago = (over: Partial<PaymentInput> = {}): PaymentInput => ({
  clinicaId: SUR.id,
  monto: '100.00',
  metodo: 'transferencia',
  fecha: '2026-10-05',
  referencia: 'TRX-1',
  notas: null,
  asignaciones: [],
  ...over,
})

const statusOf = (fake: ReturnType<typeof build>, id: string) =>
  fake.cases.find((c) => c.id === id)?.status

describe('features/accounts/service: pagos (CTA-2)', () => {
  describe('registrar un pago', () => {
    it('un reparto que cubre un trabajo lo pasa a cobrado con paid_at y escribe sus eventos', async () => {
      const fake = build()
      const p = await fake.service.registerPayment(
        pago({ asignaciones: [{ trabajoId: 'a', monto: '100.00' }] }),
        recepcion,
      )
      expect(p).toEqual({
        id: 'pago-1',
        clinicId: SUR.id,
        amount: '100.00',
        allocated: '100.00',
        credit: '0.00',
        method: 'transferencia',
        paidOn: '2026-10-05',
        reference: 'TRX-1',
        notes: null,
        createdAt: expect.any(Date),
        by: 'Recepción',
        voided: null,
        settled: [{ id: 'a', code: '26-a' }],
      })
      expect(statusOf(fake, 'a')).toBe('cobrado')
      expect(fake.paidAt.get('a')).toEqual(NOW)
      expect(fake.events).toEqual([
        {
          caseId: 'a',
          type: 'payment_applied',
          fromValue: null,
          toValue: '100.00',
          reason: 'Transferencia · TRX-1',
          actorId: 'u-recep',
        },
        {
          caseId: 'a',
          type: 'status_changed',
          fromValue: 'entregado',
          toValue: 'cobrado',
          reason: null,
          actorId: 'u-recep',
        },
      ])
    })

    it('un reparto parcial deja el trabajo entregado, con su pendiente', async () => {
      const fake = build()
      await fake.service.registerPayment(
        pago({ monto: '40.00', asignaciones: [{ trabajoId: 'a', monto: '40.00' }] }),
        recepcion,
      )
      expect(statusOf(fake, 'a')).toBe('entregado')
      expect(fake.paidAt.has('a')).toBe(false)
      expect(fake.events.map((e) => e.type)).toEqual(['payment_applied'])
      const account = await fake.service.clinicAccount(SUR.id)
      expect(account.openCases.find((c) => c.id === 'a')?.outstanding).toBe('60.00')
    })

    it('reparte entre varios trabajos y cierra solo los cubiertos', async () => {
      const fake = build()
      await fake.service.registerPayment(
        pago({
          monto: '120.00',
          asignaciones: [
            { trabajoId: 'a', monto: '100.00' },
            { trabajoId: 'b', monto: '20.00' },
          ],
        }),
        admin,
      )
      expect(statusOf(fake, 'a')).toBe('cobrado')
      expect(statusOf(fake, 'b')).toBe('entregado')
      expect(fake.events.filter((e) => e.type === 'payment_applied')).toEqual([
        expect.objectContaining({ caseId: 'a', toValue: '100.00' }),
        expect.objectContaining({ caseId: 'b', toValue: '20.00' }),
      ])
    })

    it('lo que sobra del pago queda a favor de la clínica', async () => {
      const fake = build()
      const p = await fake.service.registerPayment(
        pago({ monto: '130.00', asignaciones: [{ trabajoId: 'a', monto: '100.00' }] }),
        recepcion,
      )
      expect(p).toMatchObject({ amount: '130.00', allocated: '100.00', credit: '30.00' })
      const account = await fake.service.clinicAccount(SUR.id)
      expect(account.credit).toBe('30.00')
      // Saldo = 100 + 50 + 20 (cobrado) − 130.
      expect(account.balance).toBe('40.00')
    })

    it('un anticipo sin reparto queda todo a favor y no toca ningún trabajo', async () => {
      const fake = build()
      const p = await fake.service.registerPayment(
        pago({ monto: '25.00', referencia: null }),
        recepcion,
      )
      expect(p).toMatchObject({ amount: '25.00', allocated: '0.00', credit: '25.00' })
      expect(fake.events).toEqual([])
      expect((await fake.service.clinicAccount(SUR.id)).credit).toBe('25.00')
    })

    it('el evento lleva solo el método si el pago no tiene referencia', async () => {
      const fake = build()
      await fake.service.registerPayment(
        pago({
          metodo: 'efectivo',
          referencia: null,
          monto: '10.00',
          asignaciones: [{ trabajoId: 'b', monto: '10.00' }],
        }),
        recepcion,
      )
      expect(fake.events[0]).toMatchObject({ type: 'payment_applied', reason: 'Efectivo' })
    })

    it('una repetición se cubre con su porcentaje y un ajuste del trabajo cambia su neto', async () => {
      const fake = build({
        cases: [
          makeCase({ id: 'r', totalCents: 10_000, remakeChargePct: 50 }),
          makeCase({ id: 'd', totalCents: 10_000 }),
        ],
        adjustments: [
          {
            id: 'aj',
            clinicId: SUR.id,
            caseId: 'd',
            amountCents: -1_000,
            reason: 'Descuento',
            date: '2026-10-01',
            createdAt: at('2026-10-01'),
            createdByName: 'Admin',
          },
        ],
      })
      await fake.service.registerPayment(
        pago({
          monto: '140.00',
          asignaciones: [
            { trabajoId: 'r', monto: '50.00' },
            { trabajoId: 'd', monto: '90.00' },
          ],
        }),
        recepcion,
      )
      expect(statusOf(fake, 'r')).toBe('cobrado')
      expect(statusOf(fake, 'd')).toBe('cobrado')
    })

    it('bloquea los trabajos del reparto', async () => {
      const fake = build()
      await fake.service.registerPayment(
        pago({
          monto: '30.00',
          asignaciones: [
            { trabajoId: 'b', monto: '10.00' },
            { trabajoId: 'a', monto: '20.00' },
          ],
        }),
        recepcion,
      )
      expect(fake.locked).toEqual([['b', 'a']])
    })

    describe('dice qué trabajos cerró (UX5-04)', () => {
      // `d` se entregó antes que `a`: `settled` va de la entrega más antigua a la más nueva y, a
      // igualdad, por código (el orden del reparto sugerido), no en el del reparto que llega.
      const withD = () =>
        build({
          cases: [
            ...CASES,
            makeCase({ id: 'd', totalCents: 3_000, deliveredAt: at('2026-08-20') }),
          ],
        })

      it('trae los trabajos que pasaron a cobrado, no los que siguen debiendo', async () => {
        const fake = withD()
        const p = await fake.service.registerPayment(
          pago({
            monto: '150.00',
            asignaciones: [
              { trabajoId: 'a', monto: '100.00' },
              { trabajoId: 'b', monto: '20.00' },
              { trabajoId: 'd', monto: '30.00' },
            ],
          }),
          recepcion,
        )
        expect(p.settled).toEqual([
          { id: 'd', code: '26-d' },
          { id: 'a', code: '26-a' },
        ])
      })

      it('un recargo confirmado antes del pago deja el trabajo debiendo y no lo cuenta', async () => {
        // El diálogo sugirió 50.00 para `b` (su pendiente al abrirse); entre medio, admin le
        // registró un recargo de 10.00: queda debiendo 10.00 y sigue entregado.
        const fake = build({
          adjustments: [
            {
              id: 'aj',
              clinicId: SUR.id,
              caseId: 'b',
              amountCents: 1_000,
              reason: 'Recargo',
              date: '2026-10-05',
              createdAt: at('2026-10-05'),
              createdByName: 'Admin',
            },
          ],
        })
        const p = await fake.service.registerPayment(
          pago({
            monto: '150.00',
            asignaciones: [
              { trabajoId: 'a', monto: '100.00' },
              { trabajoId: 'b', monto: '50.00' },
            ],
          }),
          recepcion,
        )
        expect(statusOf(fake, 'b')).toBe('entregado')
        expect(p.settled).toEqual([{ id: 'a', code: '26-a' }])
      })

      it('un anticipo sin reparto no cierra nada', async () => {
        const fake = build()
        const p = await fake.service.registerPayment(pago({ monto: '25.00' }), recepcion)
        expect(p.settled).toEqual([])
      })
    })

    describe('validaciones de la decisión 8: 422 con su campo y sin escribir nada', () => {
      it.each([
        [
          'un trabajo de otra clínica',
          [{ trabajoId: 'n', monto: '10.00' }],
          'asignaciones.0.trabajoId',
          'El trabajo es de otra clínica',
        ],
        [
          'un trabajo que no está entregado',
          [
            { trabajoId: 'a', monto: '10.00' },
            { trabajoId: 'p', monto: '10.00' },
          ],
          'asignaciones.1.trabajoId',
          'El trabajo aún no está entregado',
        ],
        [
          'un trabajo ya cobrado',
          [{ trabajoId: 'c', monto: '10.00' }],
          'asignaciones.0.trabajoId',
          'El trabajo ya está cobrado',
        ],
        [
          'un trabajo que no existe',
          [{ trabajoId: 'zz', monto: '10.00' }],
          'asignaciones.0.trabajoId',
          'El trabajo no existe',
        ],
        [
          'más que el pendiente del trabajo',
          [
            { trabajoId: 'a', monto: '10.00' },
            { trabajoId: 'b', monto: '50.01' },
          ],
          'asignaciones.1.monto',
          'Supera lo pendiente del trabajo (50.00)',
        ],
        [
          'más que el monto del pago',
          [
            { trabajoId: 'a', monto: '90.00' },
            { trabajoId: 'b', monto: '20.00' },
          ],
          'asignaciones',
          'Lo asignado no puede superar el monto del pago',
        ],
      ])('%s', async (_label, asignaciones, path, message) => {
        const fake = build()
        const error = await fake.service
          .registerPayment(pago({ asignaciones }), recepcion)
          .catch((e: unknown) => e)
        expect(error).toBeInstanceOf(AccountInputError)
        expect(error).toMatchObject({ path, message })
        expect(fake.payments).toHaveLength(0)
        expect(fake.allocations).toHaveLength(0)
        expect(fake.events).toEqual([])
      })

      it('una fecha posterior a hoy (hoy sí vale)', async () => {
        const fake = build()
        await expect(
          fake.service.registerPayment(pago({ fecha: '2026-10-07' }), recepcion),
        ).rejects.toMatchObject({ path: 'fecha', message: 'La fecha no puede ser posterior a hoy' })
        expect(fake.payments).toHaveLength(0)
        await fake.service.registerPayment(pago({ fecha: '2026-10-06' }), recepcion)
        expect(fake.payments).toHaveLength(1)
      })

      it('una clínica que no existe', async () => {
        const fake = build()
        await expect(
          fake.service.registerPayment(pago({ clinicaId: 'cl-nada' }), recepcion),
        ).rejects.toMatchObject({ path: 'clinicaId', message: 'La clínica no existe' })
        expect(fake.payments).toHaveLength(0)
      })
    })

    it.each([
      ['técnico', tecnico],
      ['mensajero', mensajero],
    ])('el %s no puede registrar pagos', async (_label, ctx) => {
      const fake = build()
      await expect(fake.service.registerPayment(pago(), ctx)).rejects.toBeInstanceOf(
        AccountForbiddenError,
      )
      expect(fake.payments).toHaveLength(0)
    })
  })

  describe('aplicar saldo a favor', () => {
    /** Un pago de 80.00 con 20.00 en `a`: le quedan 60.00 a favor. */
    const withCredit = () =>
      build({
        payments: [
          makePayment({ id: 'pg', amountCents: 8_000, reference: 'CH-7', method: 'cheque' }),
        ],
        allocations: [{ paymentId: 'pg', caseId: 'a', amountCents: 2_000 }],
      })

    it('cierra un trabajo nuevo con asignaciones del mismo pago', async () => {
      const fake = withCredit()
      const p = await fake.service.applyCredit(
        'pg',
        { asignaciones: [{ trabajoId: 'b', monto: '50.00' }] },
        recepcion,
      )
      expect(p).toMatchObject({ id: 'pg', amount: '80.00', allocated: '70.00', credit: '10.00' })
      expect(p.settled).toEqual([{ id: 'b', code: '26-b' }])
      expect(fake.allocations).toContainEqual(
        expect.objectContaining({ paymentId: 'pg', caseId: 'b', amountCents: 5_000 }),
      )
      expect(statusOf(fake, 'b')).toBe('cobrado')
      expect(fake.paidAt.get('b')).toEqual(NOW)
      expect(fake.events).toEqual([
        expect.objectContaining({
          caseId: 'b',
          type: 'payment_applied',
          toValue: '50.00',
          reason: 'Cheque · CH-7',
        }),
        expect.objectContaining({ caseId: 'b', type: 'status_changed', toValue: 'cobrado' }),
      ])
      expect((await fake.service.clinicAccount(SUR.id)).credit).toBe('10.00')
    })

    it('bloquea el pago antes de leer sus asignaciones, y después los trabajos', async () => {
      const fake = withCredit()
      await fake.service.applyCredit(
        'pg',
        { asignaciones: [{ trabajoId: 'b', monto: '10.00' }] },
        recepcion,
      )
      expect(fake.lockedPayments).toEqual(['pg'])
      expect(fake.calls.filter((c) => /^(lockPayment|allocationsOf|lockCases)/.test(c))).toEqual([
        'lockPayment:pg',
        'allocationsOf:pg',
        'lockCases:b',
      ])
    })

    it('no reparte más de lo que le queda al pago (422 en asignaciones)', async () => {
      const fake = withCredit()
      await expect(
        fake.service.applyCredit(
          'pg',
          {
            asignaciones: [
              { trabajoId: 'a', monto: '30.00' },
              { trabajoId: 'b', monto: '30.01' },
            ],
          },
          recepcion,
        ),
      ).rejects.toMatchObject({
        path: 'asignaciones',
        message: 'Supera el saldo a favor de este pago (60.00)',
      })
      expect(fake.allocations).toHaveLength(1)
    })

    it('valida cada trabajo como al registrar el pago', async () => {
      const fake = withCredit()
      await expect(
        fake.service.applyCredit(
          'pg',
          { asignaciones: [{ trabajoId: 'a', monto: '80.01' }] },
          recepcion,
        ),
      ).rejects.toMatchObject({ path: 'asignaciones.0.monto' })
      await expect(
        fake.service.applyCredit(
          'pg',
          { asignaciones: [{ trabajoId: 'n', monto: '1.00' }] },
          recepcion,
        ),
      ).rejects.toMatchObject({
        path: 'asignaciones.0.trabajoId',
        message: 'El trabajo es de otra clínica',
      })
    })

    it('un pago anulado no tiene saldo a favor (409) y uno inexistente da 404', async () => {
      const fake = build({
        payments: [
          makePayment({
            id: 'pv',
            amountCents: 5_000,
            voided: { at: at('2026-10-03'), byName: 'Admin', reason: 'Duplicado' },
          }),
        ],
      })
      const asignaciones = [{ trabajoId: 'b', monto: '10.00' }]
      await expect(
        fake.service.applyCredit('pv', { asignaciones }, recepcion),
      ).rejects.toBeInstanceOf(PaymentVoidedError)
      await expect(
        fake.service.applyCredit('nada', { asignaciones }, recepcion),
      ).rejects.toBeInstanceOf(PaymentNotFoundError)
      expect(fake.allocations).toHaveLength(0)
    })

    it('el técnico no puede aplicar saldo a favor', async () => {
      const fake = withCredit()
      await expect(
        fake.service.applyCredit(
          'pg',
          { asignaciones: [{ trabajoId: 'b', monto: '1.00' }] },
          tecnico,
        ),
      ).rejects.toBeInstanceOf(AccountForbiddenError)
    })
  })

  describe('anular un pago', () => {
    /** Un pago de 130.00: 100.00 cierran `a`, 20.00 van a `b` y 10.00 quedan a favor. */
    async function paid() {
      const fake = build()
      await fake.service.registerPayment(
        pago({
          monto: '130.00',
          asignaciones: [
            { trabajoId: 'a', monto: '100.00' },
            { trabajoId: 'b', monto: '20.00' },
          ],
        }),
        recepcion,
      )
      fake.events.length = 0
      return fake
    }

    it('devuelve a entregado lo que cerró, quita el saldo a favor y escribe sus eventos', async () => {
      const fake = await paid()
      const p = await fake.service.voidPayment('pago-1', { motivo: 'Pago duplicado' }, admin)
      expect(p).toMatchObject({
        id: 'pago-1',
        amount: '130.00',
        credit: '0.00',
        voided: { at: NOW, by: 'Admin', reason: 'Pago duplicado' },
      })
      expect(statusOf(fake, 'a')).toBe('entregado')
      expect(fake.paidAt.get('a')).toBeNull()
      expect(fake.events).toEqual([
        {
          caseId: 'a',
          type: 'payment_voided',
          fromValue: null,
          toValue: '100.00',
          reason: 'Pago duplicado',
          actorId: 'u-admin',
        },
        {
          caseId: 'b',
          type: 'payment_voided',
          fromValue: null,
          toValue: '20.00',
          reason: 'Pago duplicado',
          actorId: 'u-admin',
        },
        {
          caseId: 'a',
          type: 'status_changed',
          fromValue: 'cobrado',
          toValue: 'entregado',
          reason: null,
          actorId: 'u-admin',
        },
      ])
      // Las asignaciones quedan, pero dejan de contar.
      expect(fake.allocations).toHaveLength(2)
      const account = await fake.service.clinicAccount(SUR.id)
      expect(account.credit).toBe('0.00')
      expect(account.balance).toBe('170.00')
      expect(account.openCases.map((c) => [c.id, c.outstanding])).toEqual([
        ['a', '100.00'],
        ['b', '50.00'],
      ])
    })

    it('bloquea el pago antes de leer sus asignaciones, y después los trabajos', async () => {
      const fake = await paid()
      fake.calls.length = 0
      await fake.service.voidPayment('pago-1', { motivo: 'Duplicado' }, admin)
      expect(fake.lockedPayments).toEqual(['pago-1'])
      expect(fake.calls.filter((c) => /^(lockPayment|allocationsOf|lockCases)/.test(c))).toEqual([
        'lockPayment:pago-1',
        'allocationsOf:pago-1',
        'lockCases:a,b',
      ])
    })

    it('un trabajo con dos asignaciones del mismo pago lleva un solo evento con la suma', async () => {
      const fake = build({
        payments: [makePayment({ id: 'pg', amountCents: 8_000 })],
        allocations: [
          { paymentId: 'pg', caseId: 'b', amountCents: 3_000 },
          { paymentId: 'pg', caseId: 'b', amountCents: 2_000 },
        ],
        cases: [makeCase({ id: 'b', totalCents: 5_000, status: 'cobrado' })],
      })
      await fake.service.voidPayment('pg', { motivo: 'Cheque sin fondos' }, admin)
      expect(fake.events.filter((e) => e.type === 'payment_voided')).toEqual([
        expect.objectContaining({ caseId: 'b', toValue: '50.00', reason: 'Cheque sin fondos' }),
      ])
      expect(statusOf(fake, 'b')).toBe('entregado')
    })

    it('un trabajo que otro pago sigue cubriendo no vuelve a entregado', async () => {
      const fake = build({
        payments: [
          makePayment({ id: 'p1', amountCents: 5_000 }),
          makePayment({ id: 'p2', amountCents: 5_000 }),
        ],
        allocations: [
          { paymentId: 'p1', caseId: 'b', amountCents: 5_000 },
          { paymentId: 'p2', caseId: 'b', amountCents: 5_000 },
        ],
        cases: [makeCase({ id: 'b', totalCents: 5_000, status: 'cobrado' })],
      })
      await fake.service.voidPayment('p2', { motivo: 'Duplicado' }, admin)
      expect(statusOf(fake, 'b')).toBe('cobrado')
      expect(fake.events.map((e) => e.type)).toEqual(['payment_voided'])
    })

    it('un pago ya anulado da 409 y uno inexistente, 404', async () => {
      const fake = await paid()
      await fake.service.voidPayment('pago-1', { motivo: 'Duplicado' }, admin)
      await expect(
        fake.service.voidPayment('pago-1', { motivo: 'Otra vez' }, admin),
      ).rejects.toBeInstanceOf(PaymentVoidedError)
      await expect(
        fake.service.voidPayment('nada', { motivo: 'Duplicado' }, admin),
      ).rejects.toBeInstanceOf(PaymentNotFoundError)
    })

    it.each([
      ['recepción', recepcion],
      ['técnico', tecnico],
    ])('%s no puede anular', async (_label, ctx) => {
      const fake = await paid()
      await expect(
        fake.service.voidPayment('pago-1', { motivo: 'Duplicado' }, ctx),
      ).rejects.toBeInstanceOf(AccountForbiddenError)
      expect(statusOf(fake, 'a')).toBe('cobrado')
    })
  })
})
