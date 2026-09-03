export const CASE_CODE_REGEX = /^(\d{2})-(\d{5})$/

export function formatCaseCode(year: number, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1 || seq > 99999) {
    throw new Error(`Secuencia fuera de rango: ${seq}`)
  }
  const yy = String(year % 100).padStart(2, '0')
  return `${yy}-${String(seq).padStart(5, '0')}`
}

export function parseCaseCode(code: string): { year: number; seq: number } | null {
  const m = CASE_CODE_REGEX.exec(code)
  if (!m) return null
  return { year: 2000 + Number(m[1]), seq: Number(m[2]) }
}
