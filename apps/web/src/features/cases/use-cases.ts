import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AssignTechnicianInput,
  CaseActionInput,
  CaseInput,
  RemakeInput,
  StageChangeInput,
} from '@dentalware/shared'
import { toast } from 'sonner'
import { ApiError, toastApiError } from '@/lib/api-error'
import { mutationKeys, queryKeys } from '@/lib/query-keys'
import type { CaseListQueryInput } from './api'
import {
  assignTechnician,
  changeStage,
  createCase,
  createRemake,
  fetchCase,
  fetchCaseByCode,
  fetchCases,
  fetchEvents,
  fetchRemakes,
  fetchTechnicians,
  postCaseAction,
  postComment,
  updateCase,
} from './api'
import { CASE_ACTION_DONE } from './case-action-done'

export function useCases(query: CaseListQueryInput) {
  return useQuery({
    queryKey: queryKeys.cases(query),
    queryFn: () => fetchCases(query),
    placeholderData: keepPreviousData,
  })
}

export function useCase(id: string) {
  return useQuery({ queryKey: queryKeys.case(id), queryFn: () => fetchCase(id) })
}

/** `GET /api/trabajos/codigo/:code` (Tarea 15, FIC-2 #72): ficha corta del QR. Bajo el prefijo
 * `['trabajos']` (ver `queryKeys.caseByCode`), así que avanzar fase o subir una foto desde la
 * misma pantalla la refresca igual que `useCase`. */
export function useCaseByCode(code: string) {
  return useQuery({ queryKey: queryKeys.caseByCode(code), queryFn: () => fetchCaseByCode(code) })
}

function useInvalidateCases() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['trabajos'] })
}

/** `onError` de las mutaciones del ciclo de vida (I-1, revisión de la Tarea 3). Un 409 dice
 * que el trabajo cambió por debajo —otra persona lo movió mientras esta ficha seguía abierta—:
 * se invalida todo bajo `['trabajos']` (detalle, eventos, lista) y se **espera** antes de avisar,
 * para que la ficha y sus botones muestren el estado real cuando sale el toast y `isPending`
 * no rehabilite los botones viejos. Un 500 o un fallo de red no dicen nada del estado: ahí se
 * avisa sin refrescar, que solo repetiría la petición que falla. */
export function useConflictAwareError() {
  const invalidate = useInvalidateCases()
  return async (error: unknown) => {
    if (error instanceof ApiError && error.status === 409) await invalidate()
    toastApiError(error)
  }
}

export function useCreateCase() {
  const invalidate = useInvalidateCases()
  return useMutation({
    mutationFn: (input: CaseInput) => createCase(input),
    onSuccess: (_created, input) => {
      void invalidate()
      // ENT-1: con recogida el trabajo nace «Por recoger»; el aviso dice lo que pasó.
      toast.success(input.recogida ? 'Recogida programada' : 'Trabajo creado')
    },
    onError: toastApiError,
  })
}

export function useUpdateCase() {
  const invalidate = useInvalidateCases()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CaseInput }) => updateCase(id, input),
    onSuccess: () => {
      void invalidate()
      toast.success('Trabajo actualizado')
    },
    onError: toastApiError,
  })
}

export function useEvents(id: string) {
  return useQuery({ queryKey: queryKeys.caseEvents(id), queryFn: () => fetchEvents(id) })
}

/** `POST /api/trabajos/:id/acciones`: invalida la lista, el detalle y los eventos del
 * trabajo (cada acción escribe su `case_event`) — las tres bajo el mismo prefijo
 * `['trabajos']` que ya usa `useInvalidateCases`. `onSuccess` **espera** esa invalidación
 * (no `void invalidate()`) para que `isPending` — el único indicador de "ocupado" que
 * expone este hook — siga en `true` mientras el detalle todavía está refetcheando: sin
 * esto, un botón de acción se rehabilita con el estado viejo todavía en pantalla y un
 * segundo clic duplica la mutación (M-3, revisión de la Tarea 8).
 *
 * También invalida `['cuentas']` (Iteración 5): «Marcar entregado» carga el trabajo a la cuenta
 * de su clínica, y la lista de «Cuentas» o la cuenta abiertas deben mostrar el saldo nuevo. */
export function useCaseAction(id: string) {
  const qc = useQueryClient()
  const invalidate = useInvalidateCases()
  const onError = useConflictAwareError()
  return useMutation({
    mutationKey: mutationKeys.caseAction(id),
    mutationFn: (input: CaseActionInput) => postCaseAction(id, input),
    onSuccess: async (_updated, input) => {
      await Promise.all([invalidate(), qc.invalidateQueries({ queryKey: ['cuentas'] })])
      toast.success(CASE_ACTION_DONE[input.accion])
    },
    onError,
  })
}

/** `PUT /api/trabajos/:id/fase` (Tarea 9): invalida el detalle (la fase queda en
 * `currentStageId`) y los eventos (`stage_changed`) bajo el mismo prefijo `['trabajos']`.
 *
 * `onSuccess` **espera** la invalidación, igual que `useCaseAction` y por el mismo motivo
 * (I-2 de la Tarea 9, que repitió M-3 de la Tarea 8): `isPending` es el único indicador de
 * "ocupado" que ven los botones, y con `void invalidate()` se rehabilitan mientras la
 * tarjeta sigue pintando la fase anterior. Aquí el doble toque es peor que en las acciones:
 * salta **dos** fases, deja dos `stage_changed` en la auditoría y obliga al técnico a
 * retroceder inventando un motivo. Lo mismo vale para las dos mutaciones de abajo. */
export function useChangeStage(id: string) {
  const invalidate = useInvalidateCases()
  const onError = useConflictAwareError()
  return useMutation({
    mutationFn: (input: StageChangeInput) => changeStage(id, input),
    onSuccess: async (updated) => {
      await invalidate()
      // UX3-11: la fase nueva por su nombre (la respuesta la trae); sin fase, el genérico.
      toast.success(updated.stage ? `Fase: ${updated.stage.name}` : 'Fase actualizada')
    },
    onError,
  })
}

/** `PUT /api/trabajos/:id/tecnico`: invalida el detalle y los eventos (`assigned`). */
export function useAssignTechnician(id: string) {
  const invalidate = useInvalidateCases()
  const onError = useConflictAwareError()
  return useMutation({
    mutationFn: (input: AssignTechnicianInput) => assignTechnician(id, input),
    onSuccess: async () => {
      await invalidate()
      toast.success('Técnico asignado')
    },
    onError,
  })
}

/** `GET /api/trabajos/tecnicos`: solo se llama cuando el rol puede asignar (`enabled`);
 * técnico y mensajero reciben 403 de la API, así que `TechnicianSelect` ni siquiera dispara
 * la consulta para ellos. */
export function useTechnicians(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.caseTechnicians,
    queryFn: fetchTechnicians,
    enabled,
  })
}

/** `POST /api/trabajos/:id/repetir` (Tarea 9): dos eventos `remake_created` (padre e hijo,
 * ver `repo.createRemake`), así que invalida todo bajo `['trabajos']` en vez de solo el
 * detalle del padre. */
export function useCreateRemake(parentId: string) {
  const invalidate = useInvalidateCases()
  const onError = useConflictAwareError()
  return useMutation({
    mutationFn: (input: RemakeInput) => createRemake(parentId, input),
    onSuccess: async () => {
      await invalidate()
      toast.success('Repetición creada')
    },
    onError,
  })
}

/** `GET /api/trabajos/:id/repeticiones` (#96, Tarea 9): hijos directos del padre, sin dinero.
 * Bajo el prefijo `['trabajos']` (ver `queryKeys.caseRemakes`), así que `useCreateRemake` (que
 * invalida ese prefijo) la refresca sin tocarla aparte. */
export function useCaseRemakes(id: string) {
  return useQuery({ queryKey: queryKeys.caseRemakes(id), queryFn: () => fetchRemakes(id) })
}

export function useAddComment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => postComment(id, text),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.caseEvents(id) })
      toast.success('Comentario publicado')
    },
    onError: toastApiError,
  })
}
