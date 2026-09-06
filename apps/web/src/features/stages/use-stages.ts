import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { StageInput } from '@dentalware/shared'
import { toast } from 'sonner'
import { toastApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { createStage, fetchStages, reorderStages, setStageActive, updateStage } from './api'

export function useStages(inactive: boolean) {
  return useQuery({ queryKey: queryKeys.stages(inactive), queryFn: () => fetchStages(inactive) })
}
function useInvalidateStages() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['config', 'fases'] })
}
export function useSaveStage() {
  const invalidate = useInvalidateStages()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: StageInput }) =>
      id ? updateStage(id, input) : createStage(input),
    onSuccess: (_s, { id }) => {
      void invalidate()
      toast.success(id ? 'Fase actualizada' : 'Fase creada')
    },
    onError: toastApiError,
  })
}
export function useSetStageActive() {
  const invalidate = useInvalidateStages()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setStageActive(id, active),
    onSuccess: (_s, { active }) => {
      void invalidate()
      toast.success(active ? 'Fase activada' : 'Fase desactivada')
    },
    onError: toastApiError,
  })
}
export function useReorderStages() {
  const invalidate = useInvalidateStages()
  return useMutation({
    mutationFn: reorderStages,
    onSuccess: () => void invalidate(),
    onError: toastApiError,
  })
}
