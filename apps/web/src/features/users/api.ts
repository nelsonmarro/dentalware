import type { CreateUserInput, UpdateUserInput } from '@dentalware/shared'
import { api } from '@/lib/api'
import { throwIfNotOk } from '@/lib/api-error'

const usersApi = api.api.users

export async function fetchUsers() {
  return (await (await throwIfNotOk(await usersApi.$get())).json()).users
}
export type User = Awaited<ReturnType<typeof fetchUsers>>[number]

export async function createUser(input: CreateUserInput) {
  return (await (await throwIfNotOk(await usersApi.$post({ json: input }))).json()).user
}

export async function updateUser(id: string, input: UpdateUserInput) {
  return (
    await (await throwIfNotOk(await usersApi[':id'].$patch({ param: { id }, json: input }))).json()
  ).user
}

export async function setUserBanned(id: string, banned: boolean, reason?: string) {
  return (
    await (
      await throwIfNotOk(
        await usersApi[':id'].bloqueo.$patch({ param: { id }, json: { banned, reason } }),
      )
    ).json()
  ).user
}
