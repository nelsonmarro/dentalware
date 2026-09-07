import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateUserInput, UpdateUserInput } from '@dentalware/shared'
import { toast } from 'sonner'
import { toastApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { createUser, fetchUsers, setUserBanned, updateUser } from './api'

export function useUsers(enabled = true) {
  return useQuery({ queryKey: queryKeys.users, queryFn: fetchUsers, enabled })
}

function useInvalidateUsers() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.users })
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => {
      void invalidate()
      toast.success('Usuario creado')
    },
    onError: toastApiError,
  })
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => updateUser(id, input),
    onSuccess: () => {
      void invalidate()
      toast.success('Usuario actualizado')
    },
    onError: toastApiError,
  })
}

export function useSetUserBanned() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ id, banned, reason }: { id: string; banned: boolean; reason?: string }) =>
      setUserBanned(id, banned, reason),
    onSuccess: (_u, { banned }) => {
      void invalidate()
      toast.success(banned ? 'Acceso bloqueado' : 'Acceso restablecido')
    },
    onError: toastApiError,
  })
}
