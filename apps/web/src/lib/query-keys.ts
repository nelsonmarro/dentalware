import type { CaseListQueryInput } from '@/features/cases/api'

export const queryKeys = {
  health: ['health'] as const,
  labSettings: ['config', 'laboratorio'] as const,
  clinics: (inactive: boolean) => ['config', 'clinicas', { inactive }] as const,
  clinic: (id: string) => ['config', 'clinicas', id] as const,
  doctors: (clinicId?: string, inactive = false) =>
    ['config', 'doctores', { clinicId, inactive }] as const,
  categories: (inactive: boolean) => ['config', 'categorias', { inactive }] as const,
  products: (inactive: boolean) => ['config', 'productos', { inactive }] as const,
  clinicPrices: (clinicId: string) => ['config', 'precios', clinicId] as const,
  stages: (inactive: boolean) => ['config', 'fases', { inactive }] as const,
  users: ['users'] as const,
  cases: (query: CaseListQueryInput) => ['trabajos', 'lista', query] as const,
  // Bajo el prefijo `trabajos` (T12, #68/#69): el resumen del panel de inicio depende de los
  // mismos datos que la lista, así que `useInvalidateCases` (invalida `['trabajos']`) también
  // lo refresca tras aceptar, finalizar o cualquier otra mutación de un trabajo, sin que
  // `use-summary.ts` tenga que invalidarlo aparte.
  summary: ['trabajos', 'resumen'] as const,
  case: (id: string) => ['trabajos', id] as const,
  // Bajo el prefijo `trabajos` (Tarea 15, FIC-2 #72): la ficha corta del QR necesita
  // refrescarse cuando se avanza la fase o se sube una foto, igual que el detalle por id;
  // `useInvalidateCases` (invalida `['trabajos']`) ya la alcanza sin tocarla aparte.
  caseByCode: (code: string) => ['trabajos', 'codigo', code] as const,
  // Bajo el prefijo `users`, no `trabajos` (M-7, ola de fixes del PR 1, lote B): son los
  // técnicos activos (`GET /api/trabajos/tecnicos`, dato de la feature `users`, no de
  // `cases`) que llenan el `<select>` de `TechnicianSelect`. Con el prefijo viejo, una alta/
  // edición/baja de usuario (`useInvalidateUsers`, invalida `['users']`) no lo tocaba —dar de
  // baja a un técnico no refrescaba el selector, que lo seguía ofreciendo hasta la próxima
  // mutación de un trabajo— y en cambio cualquier mutación de trabajo sí lo invalidaba sin
  // necesidad (la lista de técnicos no cambia por aceptar o finalizar un trabajo). Al vivir
  // bajo `['users']`, `qc.invalidateQueries({ queryKey: queryKeys.users })` ya lo alcanza por
  // coincidencia de prefijo (comportamiento por defecto de TanStack Query, `exact: false`):
  // no hace falta invalidarlo aparte en cada mutación de `use-users.ts`.
  caseTechnicians: ['users', 'tecnicos'] as const,
  // Bajo `users` por el mismo motivo que `caseTechnicians`: son usuarios con rol mensajero
  // (`GET /api/entregas/mensajeros`); dar de baja a uno refresca los selectores.
  couriers: ['users', 'mensajeros'] as const,
  // Bajo el prefijo `trabajos` (Tarea 7, ENT-5): cada acción sobre un trabajo (recibir,
  // marcar enviado o entregado, cancelar) cambia sus entregas, así que `useInvalidateCases`
  // (invalida `['trabajos']`) refresca «Entregas» y el inicio del mensajero sin tocarlos aparte;
  // y la entrega fallida invalida el mismo prefijo, que también alcanza el historial del trabajo.
  deliveries: {
    day: (dia: string, mensajeroId?: string) =>
      ['trabajos', 'entregas', dia, mensajeroId ?? null] as const,
  },
  caseEvents: (id: string) => ['trabajos', id, 'eventos'] as const,
  // Bajo el prefijo `trabajos` (#96, Tarea 9): repetir el trabajo (`useCreateRemake`, que
  // invalida ese prefijo) refresca el bloque «Repeticiones» de la ficha del padre sin tocarlo
  // aparte.
  caseRemakes: (id: string) => ['trabajos', id, 'repeticiones'] as const,
  attachments: (caseId: string) => ['trabajos', caseId, 'adjuntos'] as const,
}

/**
 * Claves de las mutaciones que cierran una entrega de un trabajo (M-4 de la revisión final de la
 * ola It4). Todas cuelgan de `case(caseId)`: `useCaseBusy` cuenta por ese prefijo las pendientes
 * o en pausa de un trabajo, venga de donde venga (tarjeta de «Entregas», ficha o un diálogo ya
 * cerrado), para que sin red no se pueda repetir la misma acción.
 */
export const mutationKeys = {
  case: (caseId: string) => ['trabajos', caseId] as const,
  caseAction: (caseId: string) => ['trabajos', caseId, 'accion'] as const,
  proofUpload: (caseId: string) => ['trabajos', caseId, 'constancia'] as const,
  deliveryFail: (caseId: string) => ['trabajos', caseId, 'no-se-pudo'] as const,
  pickUp: (caseId: string) => ['trabajos', caseId, 'recogido'] as const,
}
