import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CaseActionInput, CaseInput } from '@dentalware/shared'
import { toast } from 'sonner'
import { toastApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import type { CaseListQueryInput } from './api'
import {
  createCase,
  fetchCase,
  fetchCases,
  fetchEvents,
  postCaseAction,
  postComment,
  updateCase,
} from './api'

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

function useInvalidateCases() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['trabajos'] })
}

export function useCreateCase() {
  const invalidate = useInvalidateCases()
  return useMutation({
    mutationFn: (input: CaseInput) => createCase(input),
    onSuccess: () => {
      void invalidate()
      toast.success('Trabajo creado')
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
 * segundo clic duplica la mutación (M-3, revisión de la Tarea 8). */
export function useCaseAction(id: string) {
  const invalidate = useInvalidateCases()
  return useMutation({
    mutationFn: (input: CaseActionInput) => postCaseAction(id, input),
    onSuccess: async () => {
      await invalidate()
      toast.success('Trabajo actualizado')
    },
    onError: toastApiError,
  })
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
