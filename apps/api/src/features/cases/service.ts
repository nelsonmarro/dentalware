import {
  missingForAccept,
  type CaseInput,
  type CaseListQuery,
  type UserRole,
} from '@dentalware/shared'
import type { Clock } from '../../lib/clock.ts'
import type { RequestContext } from '../../lib/request-context.ts'
import { CaseNotFoundError } from './errors.ts'
import type {
  AttachmentsQuery,
  CaseDetail,
  CaseListRow,
  CasesRepository,
  UnitOfWork,
} from './ports.ts'

const hidesPrices = (role: UserRole) => role === 'tecnico' || role === 'mensajero'

type Priced = {
  total: string | null
  internalNotes: string | null
  items: { unitPrice: string | null; lineTotal: string | null; discountPct: string | null }[]
}
/** Oculta precios y notas internas a quien no debe verlos (técnico/mensajero). */
export function stripPrices<T extends Priced>(row: T): T {
  return {
    ...row,
    total: null,
    internalNotes: null,
    items: row.items.map((i) => ({ ...i, unitPrice: null, lineTotal: null, discountPct: null })),
  }
}

/** Oculta los valores de los eventos `price_changed` (llevan "productId:precio") a quien no debe ver precios. */
export function maskPriceEvents<
  T extends { type: string; fromValue: string | null; toValue: string | null },
>(events: T[], hide: boolean): T[] {
  if (!hide) return events
  return events.map((e) =>
    e.type === 'price_changed' ? { ...e, fromValue: null, toValue: null } : e,
  )
}

function readiness(
  c: CaseDetail,
  hasPrescriptionDocument: boolean,
): ReturnType<typeof missingForAccept> {
  return missingForAccept({
    clinicId: c.clinicId,
    doctorId: c.doctorId,
    patientRef: c.patientRef,
    dueDate: c.dueDate,
    shade: c.shade,
    prescription: c.prescription,
    hasPrescriptionDocument,
    checklist: c.checklist,
    items: c.items.map((i) => ({ pricingUnit: i.product!.pricingUnit, teeth: i.teeth })),
  })
}

export function createCasesService(deps: {
  cases: CasesRepository
  attachments: AttachmentsQuery
  uow: UnitOfWork
  clock: Clock
}) {
  const mustGet = async (id: string) => {
    const found = await deps.cases.byId(id)
    if (!found) throw new CaseNotFoundError()
    return found
  }
  return {
    async list(q: CaseListQuery, ctx: RequestContext) {
      const page = await deps.cases.list(q, deps.clock.today())
      if (!hidesPrices(ctx.role)) return page
      return {
        ...page,
        cases: page.cases.map((r): CaseListRow => ({ ...r, total: null })),
      }
    },
    async detail(id: string, ctx: RequestContext) {
      const found = await mustGet(id)
      const hasDoc = await deps.attachments.hasDocument(id)
      return {
        case: hidesPrices(ctx.role) ? stripPrices(found) : found,
        missing: readiness(found, hasDoc),
      }
    },
    async create(input: CaseInput, ctx: RequestContext) {
      const { id } = await deps.uow.run(({ cases }) => cases.create(input, ctx.userId))
      return mustGet(id)
    },
    async update(id: string, input: CaseInput, ctx: RequestContext) {
      const ok = await deps.uow.run(({ cases }) => cases.update(id, input, ctx.userId))
      if (!ok) throw new CaseNotFoundError()
      return mustGet(id)
    },
    async events(caseId: string, ctx: RequestContext) {
      return maskPriceEvents(await deps.cases.events(caseId), hidesPrices(ctx.role))
    },
    async comment(caseId: string, text: string, ctx: RequestContext) {
      await mustGet(caseId)
      await deps.cases.addEvent({ caseId, type: 'comment', toValue: text, actorId: ctx.userId })
      const events = maskPriceEvents(await deps.cases.events(caseId), hidesPrices(ctx.role))
      return events[events.length - 1]!
    },
  }
}
export type CasesService = ReturnType<typeof createCasesService>
