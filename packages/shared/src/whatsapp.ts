/** Cómo se escribe un número en Ecuador («099 123 4567») a E.164 (`+593991234567`), UX7-06:
 * quita espacios, guiones, paréntesis y puntos; `00` internacional pasa a `+`; un número local
 * de 10 dígitos que empieza por 0 recibe el +593; el 0 que muchos dejan tras el prefijo
 * («+593 099 123 4567», «+593 (0)99 123 4567») se quita, porque +5930… no existe. Lo demás se devuelve limpio de separadores,
 * y es el schema quien lo acepta o lo rechaza. No valida: solo normaliza. */
export function normalizeWhatsapp(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, '')
  const digits = cleaned.startsWith('00') ? `+${cleaned.slice(2)}` : cleaned
  const withoutTrunkZero = /^\+5930(\d{9})$/.exec(digits)
  if (withoutTrunkZero) return `+593${withoutTrunkZero[1]}`
  if (/^0\d{9}$/.test(digits)) return `+593${digits.slice(1)}`
  return digits
}
