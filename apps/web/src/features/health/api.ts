import { api } from '@/lib/api'

export async function fetchHealth() {
  const res = await api.api.health.$get()
  return res.json()
}
