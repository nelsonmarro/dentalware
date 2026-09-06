/** Formatea una fecha ISO (`AAAA-MM-DD`) a `dd/mm/aaaa`; `null` → `—`. */
export function formatDate(date: string | null): string {
  if (!date) return '—'
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}
