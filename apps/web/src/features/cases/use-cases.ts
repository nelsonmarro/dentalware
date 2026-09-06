import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CaseInput } from '@dentalware/shared'
import { toast } from 'sonner'
import { toastApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import type { CaseListQueryInput } from './api'
import { createCase, fetchCase, fetchCases, fetchEvents, postComment, updateCase } from './api'

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
