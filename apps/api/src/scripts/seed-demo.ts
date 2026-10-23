import { toIsoDate, type CaseActionInput } from '@dentalware/shared'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import type { Auth } from '../auth.ts'
import { createAuth } from '../auth.ts'
import { loadConfig } from '../config.ts'
import type { Db } from '../db/index.ts'
import { createDb } from '../db/index.ts'
import { runMigrations } from '../db/migrate.ts'
import { clinics, users } from '../db/schema/index.ts'
import { createClinic } from '../features/clinics/repo.ts'
import { createDoctor } from '../features/doctors/repo.ts'
import { upsertLabSettings } from '../features/lab-settings/repo.ts'
import { listProducts, upsertClinicPrice } from '../features/products/repo.ts'
import { fixedClockAt } from '../lib/clock.ts'
import { createStorage } from '../lib/create-storage.ts'
import { isMainModule } from '../lib/is-main-module.ts'
import type { RequestContext } from '../lib/request-context.ts'
import type { Storage } from '../lib/storage.ts'
import { createServices } from '../services.ts'
import {
  DEMO_CASES,
  DEMO_CLINICS,
  DEMO_LAB,
  DEMO_USERS,
  type DemoClinicKey,
  type DemoUserKey,
} from './seed-demo-data.ts'

/** Igual que `assertTestEnv` de `reset-test-db.ts`: el seed de demostración escribe usuarios,
 * clínicas y trabajos ficticios, así que nunca corre fuera de la BD de test. La contraseña de
 * los usuarios de demostración llega por el entorno en cada corrida y nunca se guarda. */
export function assertDemoEnv(
  nodeEnv: string,
  demoPassword: string | undefined,
): asserts demoPassword is string {
  if (nodeEnv !== 'test') {
    throw new Error(
      `seed:demo solo se ejecuta con NODE_ENV=test (recibido "${nodeEnv}"): escribiría en una BD real`,
    )
  }
  if (!demoPassword) {
    throw new Error(
      'seed:demo necesita DEMO_PASSWORD (la contraseña de los usuarios de demostración; genérala en cada corrida, nunca la guardes)',
    )
  }
}

export type DemoSeedContext = {
  db: Db
  auth: Auth
  storage: Storage
  adminEmail: string
  demoPassword: string
  /** El «hoy» del seed (`YYYY-MM-DD`): el mismo día que fija `CLOCK_FIXED_AT` en la API. */
  today: string
}
export type DemoSeedResult = {
  users: Record<DemoUserKey, string>
  clinics: Record<DemoClinicKey, string>
  cases: Record<string, string>
}
type Scenario = (typeof DEMO_CASES)[number]['escenario']

/** `n` días de calendario desde `today` (negativo = pasado), en fecha de negocio `YYYY-MM-DD`. */
function daysFrom(today: string, n: number): string {
  const d = new Date(`${today}T12:00:00`)
  d.setDate(d.getDate() + n)
  return toIsoDate(d)
}

/** Una foto ficticia: un rectángulo teal, generado al vuelo (ningún binario en el repo). */
async function demoPhoto(): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({ create: { width: 800, height: 600, channels: 3, background: '#0f766e' } })
      .jpeg()
      .toBuffer(),
  )
}

/**
 * Datos de demostración para las capturas del manual (Iteración 8, MAN-1): un laboratorio,
 * usuarios, clínicas y trabajos ficticios, uno por escenario que el manual enseña. Los
 * catálogos van por los repos CRUD simples; todo lo demás, por los mismos servicios que la API
 * (`createServices`), con el reloj fijo en `today`: las reglas de negocio se cumplen igual que
 * en la app y no hay inserts a mano. Se niega si ya corrió sobre esta BD.
 */
export async function seedDemo({
  db,
  auth,
  storage,
  adminEmail,
  demoPassword,
  today,
}: DemoSeedContext): Promise<DemoSeedResult> {
  const existing = await db
    .select({ id: clinics.id })
    .from(clinics)
    .where(eq(clinics.name, DEMO_CLINICS[0].name))
  if (existing.length > 0) {
    throw new Error('seed:demo: ya hay datos de demostración; corre reset-test-db y seed antes')
  }
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail))
  if (!admin)
    throw new Error(`seed:demo: no existe el admin ${adminEmail}; corre el seed normal antes`)
  const ctx: RequestContext = { userId: admin.id, role: 'admin' }
  const daysFromToday = (n: number) => daysFrom(today, n)
  // El mismo reloj que la API con `CLOCK_FIXED_AT`: las validaciones «no anterior a hoy» miran
  // este día.
  const services = createServices({ db, storage, clock: fixedClockAt(`${today}T10:30:00-05:00`) })

  await upsertLabSettings(db, DEMO_LAB)

  const userIds = {} as Record<DemoUserKey, string>
  for (const u of DEMO_USERS) {
    const created = await auth.api.signUpEmail({
      body: { email: u.email, password: demoPassword, name: u.name },
    })
    // `role` tiene input:false en Better Auth: se fija en servidor (como `ensureAdmin`).
    await db.update(users).set({ role: u.role }).where(eq(users.id, created.user.id))
    userIds[u.key] = created.user.id
  }

  const products = await listProducts(db, false)
  const productId = (code: string) => {
    const p = products.find((x) => x.code === code)
    if (!p) throw new Error(`seed:demo: el catálogo no tiene el producto ${code}`)
    return p.id
  }
  const clinicIds = {} as Record<DemoClinicKey, string>
  const doctorIds = {} as Record<DemoClinicKey, string>
  for (const c of DEMO_CLINICS) {
    const clinic = await createClinic(db, {
      name: c.name,
      ruc: null,
      address: c.address,
      city: c.city,
      phone: c.phone,
      whatsapp: c.whatsapp,
      email: null,
      paymentTermsDays: 30,
      notes: null,
    })
    clinicIds[c.key] = clinic.id
    for (const [i, name] of c.doctors.entries()) {
      const d = await createDoctor(db, {
        clinicId: clinic.id,
        name,
        phone: null,
        email: null,
        notes: null,
      })
      if (i === 0) doctorIds[c.key] = d.id
    }
    for (const [code, price] of Object.entries(c.prices)) {
      await upsertClinicPrice(db, clinic.id, productId(code), price)
    }
  }

  const caseIds: Record<string, string> = {}
  for (const spec of DEMO_CASES) {
    const courierId = 'courier' in spec ? userIds[spec.courier] : undefined
    const conRecogida = spec.escenario === 'por_recoger' || spec.escenario === 'en_camino'
    const recogida =
      conRecogida && courierId ? { mensajeroId: courierId, fecha: daysFromToday(0) } : undefined
    const created = await services.cases.create(
      {
        clinicId: clinicIds[spec.clinic],
        doctorId: doctorIds[spec.clinic],
        patientRef: spec.patient,
        patientAge: null,
        patientSex: null,
        boxNumber: null,
        priority: 'normal',
        receivedAt: daysFromToday(spec.recibidoHace),
        dueDate: daysFromToday(spec.venceEn),
        shade: 'A2',
        shadeSystem: 'vita_classical',
        reference: null,
        checklist: { antagonista: true, mordida: true, color: true, fotos: false },
        observations: null,
        // «Aceptar» exige prescripción (texto o documento, `missingForAccept`).
        prescription: 'Según el modelo y el color indicado.',
        internalNotes: null,
        assignedTechnicianId: userIds.tecnico,
        items: [
          {
            productId: productId(spec.product),
            description: null,
            quantity: Math.max(1, spec.teeth.length),
            teeth: [...spec.teeth],
            unitPrice: null,
            discountPct: 0,
            material: null,
            notes: null,
          },
        ],
        recogida,
      },
      ctx,
    )
    caseIds[spec.key] = created.id
    await runScenario(spec.escenario, created.id, courierId ?? userIds.mensajero)
  }

  // Una repetición al 50 % (enseña `remake` y el cargo parcial en la cuenta).
  const remake = await services.cases.createRemake(
    caseIds['entregado-2']!,
    { motivo: 'Ajuste de color pedido por el doctor', responsabilidad: 'compartida', cobroPct: 50 },
    ctx,
  )
  caseIds['repeticion'] = remake.id
  // Un pago parcial con saldo a favor: «norte» debe `entregado` y `entregado-2`; paga 80 y
  // aplica 60 a `entregado`, que sigue debiendo; los 20 restantes quedan a favor.
  await services.accounts.registerPayment(
    {
      clinicaId: clinicIds.norte,
      monto: '80.00',
      metodo: 'transferencia',
      fecha: daysFromToday(0),
      referencia: 'TRX-0001',
      notas: null,
      asignaciones: [{ trabajoId: caseIds['entregado']!, monto: '60.00' }],
    },
    ctx,
  )
  // `cobrado`: «paredes» paga entero lo que debe ese trabajo, y las cuentas lo cierran.
  const paredes = await services.accounts.clinicAccount(clinicIds.paredes)
  const owed = paredes.openCases.find((c) => c.id === caseIds['cobrado'])
  if (!owed) throw new Error('seed:demo: el trabajo a cobrar no quedó «Por cobrar»')
  await services.accounts.registerPayment(
    {
      clinicaId: clinicIds.paredes,
      monto: owed.outstanding,
      metodo: 'efectivo',
      fecha: daysFromToday(0),
      referencia: null,
      notas: null,
      asignaciones: [{ trabajoId: owed.id, monto: owed.outstanding }],
    },
    ctx,
  )
  // Un saldo inicial sin trabajo (ajuste), en «alamos».
  await services.accounts.registerAdjustment(
    {
      clinicaId: clinicIds.alamos,
      trabajoId: null,
      monto: '35.00',
      motivo: 'Saldo inicial',
      fecha: daysFromToday(-40),
    },
    ctx,
  )

  return { users: userIds, clinics: clinicIds, cases: caseIds }

  async function act(
    id: string,
    accion: CaseActionInput['accion'],
    extra: Partial<CaseActionInput> = {},
  ) {
    await services.cases.action(id, { accion, motivo: null, ...extra }, ctx)
  }

  /** Lleva el trabajo recién creado a su estado final con acciones reales, en el orden en que
   * las haría el laboratorio. */
  async function runScenario(escenario: Scenario, id: string, courierId: string) {
    switch (escenario) {
      case 'por_recoger':
        return
      case 'en_camino': {
        // El mensajero la marca «Recogido» (`canMarkPickedUp`: solo en la suya): el trabajo
        // sigue `por_recoger` y la tarjeta dice «En camino al laboratorio» (#118).
        const pending = (await services.cases.detail(id, ctx)).case.pendingDelivery
        if (!pending) throw new Error('seed:demo: la recogida no quedó pendiente')
        await services.deliveries.pickUp(pending.id, { userId: courierId, role: 'mensajero' })
        return
      }
      case 'nuevo':
        return
      case 'en_proceso':
        await act(id, 'aceptar')
        return
      case 'en_proceso_fase_3':
        await act(id, 'aceptar')
        await services.cases.changeStage(id, { direccion: 'avanzar', motivo: null }, ctx)
        await services.cases.changeStage(id, { direccion: 'avanzar', motivo: null }, ctx)
        return
      case 'en_espera':
        await act(id, 'aceptar')
        await act(id, 'pausar', { motivo: 'Falta el antagonista' })
        return
      case 'en_prueba':
        await act(id, 'aceptar')
        await act(id, 'enviar_prueba')
        return
      case 'terminado':
        await act(id, 'aceptar')
        await act(id, 'finalizar')
        return
      case 'enviado':
        await ship(id, courierId)
        return
      case 'entregado':
      case 'cobrado': {
        // `cobrado` se entrega igual: lo cierra después el pago completo (cuentas).
        await ship(id, courierId)
        const bytes = await demoPhoto()
        const proof = await services.attachments.upload(
          {
            caseId: id,
            filename: 'constancia.jpg',
            mime: 'image/jpeg',
            size: bytes.byteLength,
            bytes,
            kind: 'constancia',
          },
          ctx,
        )
        await act(id, 'marcar_entregado', { constanciaId: proof.id })
        return
      }
      case 'entrega_fallida': {
        await ship(id, courierId)
        const pending = (await services.cases.detail(id, ctx)).case.pendingDelivery
        if (!pending) throw new Error('seed:demo: el envío no dejó entrega pendiente')
        await services.deliveries.fail(
          pending.id,
          { motivo: 'La clínica estaba cerrada', nuevaFecha: daysFromToday(0) },
          ctx,
        )
        return
      }
      case 'cancelado':
        await act(id, 'cancelar', { motivo: 'El doctor retiró el pedido' })
        return
    }
  }

  /** Aceptar, finalizar y enviar. Las fechas de envío no pueden ser anteriores a hoy: todo se
   * envía «hoy». */
  async function ship(id: string, courierId: string) {
    await act(id, 'aceptar')
    await act(id, 'finalizar')
    await act(id, 'marcar_enviado', { envio: { mensajeroId: courierId, fecha: daysFromToday(0) } })
  }
}

async function main() {
  const config = loadConfig()
  const demoPassword = process.env.DEMO_PASSWORD
  assertDemoEnv(config.NODE_ENV, demoPassword)
  const { db, pool } = createDb(config.DATABASE_URL)
  try {
    await runMigrations(db)
    const auth = createAuth(db, config)
    // El día del reloj fijo de la API si lo hay (capturas); si no, el de la máquina.
    const today = config.CLOCK_FIXED_AT
      ? fixedClockAt(config.CLOCK_FIXED_AT).today()
      : toIsoDate(new Date())
    const result = await seedDemo({
      db,
      auth,
      storage: createStorage(config),
      adminEmail: config.ADMIN_EMAIL,
      demoPassword,
      today,
    })
    console.log(
      `Datos de demostración listos (hoy = ${today}): ${Object.keys(result.cases).length} trabajos, ${Object.keys(result.clinics).length} clínicas, ${Object.keys(result.users).length} usuarios`,
    )
  } finally {
    await pool.end()
  }
}

// Solo ejecuta `main` cuando el archivo corre como script (`tsx src/scripts/seed-demo.ts`), no
// cuando `seed-demo.test.ts` importa `seedDemo` (mismo patrón que `seed.ts`).
if (isMainModule(import.meta.url)) {
  await main()
}
