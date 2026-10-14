/** Cómo se escribe un número en Ecuador («099 123 4567») a E.164 (`+593991234567`), UX7-06:
 * quita espacios, guiones, paréntesis y puntos; `00` internacional pasa a `+`; un número local
 * de 10 dígitos que empieza por 0 recibe el +593. Lo demás se devuelve limpio de separadores,
 * y es el schema quien lo acepta o lo rechaza. No valida: solo normaliza. */
export function normalizeWhatsapp(raw: string): string {
  const digits = raw.replace(/[\s\-().]/g, '')
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  if (/^0\d{9}$/.test(digits)) return `+593${digits.slice(1)}`
  return digits
}
