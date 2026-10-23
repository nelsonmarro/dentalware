import type { Db } from './db/index.ts'
import { createAccountsRepo, drizzleAccountsUnitOfWork } from './features/accounts/repo.ts'
import { createAccountsService } from './features/accounts/service.ts'
import { createAttachmentsRepo } from './features/attachments/repo.ts'
import { createAttachmentsService } from './features/attachments/service.ts'
import { createImportCatalog } from './features/cases/import.repo.ts'
import { createImportService } from './features/cases/import.service.ts'
import {
  createCaseSettlement,
  createCasesRepo,
  createUsersQuery,
  drizzleUnitOfWork,
} from './features/cases/repo.ts'
import { createCasesService } from './features/cases/service.ts'
import {
  createCouriersQuery,
  createCaseDeliveryInfoQuery,
  createDeliveriesRepo,
  drizzleDeliveriesUnitOfWork,
} from './features/deliveries/repo.ts'
import { createDeliveriesService } from './features/deliveries/service.ts'
import { listStages } from './features/stages/repo.ts'
import type { Clock } from './lib/clock.ts'
import { systemClock } from './lib/clock.ts'
import type { IdGenerator } from './lib/ids.ts'
import { randomIds } from './lib/ids.ts'
import { sharpImages } from './lib/images.ts'
import type { Storage } from './lib/storage.ts'

export type ServicesDeps = { db: Db; storage: Storage; clock?: Clock; ids?: IdGenerator }

/** Raíz de composición de los casos de uso: la usan `createApp` (rutas) y `scripts/seed-demo.ts`
 * (datos de demostración por los mismos servicios, sin inserts), sin duplicar el cableado. */
export function createServices({ db, storage, clock, ids }: ServicesDeps) {
  const casesRepo = createCasesRepo(db)
  const attachmentsRepo = createAttachmentsRepo(db)
  const effectiveClock = clock ?? systemClock
  // La unidad de trabajo de `cases` re-crea el repositorio de entregas sobre su `tx` (ADR 19):
  // la factoría se inyecta aquí para que `cases/repo.ts` no importe `deliveries/repo.ts`.
  const casesUow = drizzleUnitOfWork(db, { deliveries: createDeliveriesRepo })
  const couriersQuery = createCouriersQuery(db)
  const accountsRepo = createAccountsRepo(db)
  const casesService = createCasesService({
    // `CaseAccountQuery` lo declara `cases` y lo cumple el repo de `accounts` (ADR 35): Σ
    // ajustes y Σ asignaciones vigentes del trabajo para la cuenta de su ficha.
    account: accountsRepo,
    cases: casesRepo,
    attachments: attachmentsRepo,
    // Puerto de la feature `stages` (CRUD simple, sin ports.ts propio): solo las fases activas.
    stages: { active: () => listStages(db, false) },
    // Puerto de la feature `users` (ADR 24: `createUsersQuery` lee `users` por join/lectura de
    // solo lectura desde el `repo.ts` de `cases`, sin importar el `repo`/rutas de `users`).
    users: createUsersQuery(db),
    // `CouriersLookup` es un puerto declarado por `cases`; aquí se cumple con
    // `createCouriersQuery` de `deliveries` (ADR 24): valida el mensajero de una recogida o un
    // envío y da su nombre para el historial, sobre la lista que alimenta el selector.
    couriers: {
      findActiveCourier: async (userId) =>
        (await couriersQuery.activeCouriers()).find((c) => c.id === userId),
    },
    // Lectura de la entrega pendiente y de la última hecha para la ficha (M-4, UX4-07/09),
    // fuera de la transacción; las escrituras de entregas siguen dentro de `uow.run`.
    deliveries: createCaseDeliveryInfoQuery(db),
    // Sin `tryins` aquí: el servicio solo accede a pruebas en boca dentro de `uow.run`
    // (transaccional, ADR 19). Una instancia suelta invitaría a escribir fuera de la tx.
    uow: casesUow,
    clock: effectiveClock,
  })
  // `uow` propio de `deliveries` (distinto del `casesUow`): compone `createDeliveriesRepo(tx)`
  // con un `CaseEventLog` adaptado de `createCasesRepo(tx).addEvent`, sin que `deliveries/`
  // importe nada de `cases/` (la frontera la cruza solo esta raíz de composición).
  const deliveriesUow = drizzleDeliveriesUnitOfWork(db, {
    events: (tx) => ({ addEvent: (e) => createCasesRepo(tx).addEvent(e) }),
  })
  const deliveriesService = createDeliveriesService({
    deliveries: createDeliveriesRepo(db),
    couriers: couriersQuery,
    uow: deliveriesUow,
    clock: effectiveClock,
  })
  const importService = createImportService({
    catalog: createImportCatalog(db),
    uow: casesUow,
    clock: effectiveClock,
  })
  const attachmentsService = createAttachmentsService({
    attachments: attachmentsRepo,
    cases: { exists: async (id) => (await casesRepo.byId(id)) !== undefined },
    events: { add: (e) => casesRepo.addEvent(e) },
    // `PendingDeliveryLookup` y `DeliveryProofLookup` los declara `attachments`; aquí se cumplen
    // con el repo de `deliveries` (ADR 34), sin que una feature importe el `repo.ts` de la otra.
    deliveries: createDeliveriesRepo(db),
    storage,
    images: sharpImages,
    ids: ids ?? randomIds,
  })

  // Cuentas (CTA-1/2): el repo lee `cases` por join (ADR 24) y el servicio calcula con las
  // reglas de `shared`. Su `uow` compone `createAccountsRepo(tx)` con el `CaseSettlement` que
  // cumple el repo de `cases` sobre la misma `tx` (ADR 35, patrón de ADR 34): `accounts/` no
  // importa nada de `cases/`.
  const accountsService = createAccountsService({
    accounts: accountsRepo,
    uow: drizzleAccountsUnitOfWork(db, { cases: createCaseSettlement }),
    clock: effectiveClock,
  })

  return {
    cases: casesService,
    deliveries: deliveriesService,
    import: importService,
    attachments: attachmentsService,
    accounts: accountsService,
  }
}
export type Services = ReturnType<typeof createServices>
